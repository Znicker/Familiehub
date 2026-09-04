/* ============================================================
   /api/hent - ukeplanene fra skolens side
   ------------------------------------------------------------
   Cloudflare Pages Function. Ligger i repoet som
   functions/api/hent.js og svarer paa /api/hent.

   HVORFOR SERVERSIDEN: nettleseren faar ikke hente fra
   roligheden.skole.arendal.no - skolen sender ingen CORS-hoder
   til neam.no, og det er ikke noe vi kan gjoere fra vaar side.
   Anthropics egen henter er heller ikke en vei: sidas robots.txt
   forbyr automatisk henting, og den henteren respekterer det.

   To ting den gjoer:
     ?hva=liste          - lenkene under «Ukeplaner og filer»
     ?hva=fil&url=...    - henter en .docx og gir teksten

   Utpakkingen av .docx skjer HER og ikke i nettleseren, saa
   sida slipper aa baere en zip-leser og det virker likt paa
   alle enhetene i huset.

   VERTEN ER LAAST. Bare skolens eget domene kan hentes. Uten
   den sperren ville endepunktet vaert en aapen videresender som
   hvem som helst kunne brukt til aa hente hva som helst gjennom
   vaart domene - og med vaar IP som avsender.
   ============================================================ */

const VERT  = 'roligheden.skole.arendal.no';
const ROT   = 'https://' + VERT;
const SIDEN = ROT + '/index.php?pageID=181';

/* Et lite tak. En ukeplan er noen titalls kilobyte; er svaret mange
   megabyte, er det noe annet enn det vi ba om. */
const MAKS = 8 * 1024 * 1024;

function svar(obj, status){
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

/* ------------------------------------------------------------
   HTML -> lenkene vi er ute etter
   ------------------------------------------------------------ */

function avkod(s){
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&aring;/g, 'å').replace(/&oslash;/g, 'ø').replace(/&aelig;/g, 'æ')
    .replace(/&Aring;/g, 'Å').replace(/&Oslash;/g, 'Ø').replace(/&AElig;/g, 'Æ');
}

function absolutt(href){
  const h = String(href || '').trim();
  if(/^https?:\/\//i.test(h)) return h;
  if(h.startsWith('//')) return 'https:' + h;
  if(h.startsWith('/'))  return ROT + h;
  return ROT + '/' + h;
}

function lenkerFra(html){
  const ut = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while((m = re.exec(html)) !== null){
    const url  = absolutt(avkod(m[1]));
    const navn = avkod(m[2].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
    if(!navn) continue;
    /* Bare vaart eget domene, og bare dokumenter eller noe som ser ut
       som en ukeplan. Menyen paa sida er stor. */
    if(url.indexOf(ROT) !== 0) continue;
    const uke = (navn.match(/uke\s*(\d{1,2})/i) || [])[1];
    const dok = /\.(docx?|pdf|odt)(\?|$)/i.test(url);
    if(!uke && !dok && !/timeplan/i.test(navn)) continue;
    ut.push({ navn: navn, url: url, uke: uke ? parseInt(uke, 10) : null, dokument: dok });
  }
  /* Samme fil kan staa to steder paa sida. */
  const sett = {};
  return ut.filter(function(l){
    if(sett[l.url]) return false;
    sett[l.url] = true;
    return true;
  });
}

/* ------------------------------------------------------------
   .docx -> tekst
   ------------------------------------------------------------
   En .docx er en ZIP. Vi leter opp word/document.xml i
   sentralkatalogen, blaaser den opp med DecompressionStream, og
   gjoer XML-en om til tekst.

   Ingen zip-leser utenfra: Workers har ikke npm-pakker uten et
   byggesteg, og det som trengs her er tre felt i to poster.
   ------------------------------------------------------------ */

function u16(d, i){ return d.getUint16(i, true); }
function u32(d, i){ return d.getUint32(i, true); }

function finnEOCD(d, n){
  /* Slutten av sentralkatalogen ligger bakerst, etter en kommentar som
     kan vaere opptil 65535 tegn. Vi leter bakfra. */
  const minst = Math.max(0, n - 65557);
  for(let i = n - 22; i >= minst; i--){
    if(u32(d, i) === 0x06054b50) return i;
  }
  return -1;
}

async function blaasOpp(buf, metode){
  if(metode === 0) return new Uint8Array(buf);
  if(metode !== 8) throw new Error('Ukjent komprimering i dokumentet (' + metode + ')');
  const str = new Blob([buf]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(str).arrayBuffer());
}

async function docxTilTekst(bytes){
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = bytes.byteLength;

  const eocd = finnEOCD(d, n);
  if(eocd < 0) throw new Error('Dokumentet ser ikke ut som en .docx-fil.');

  const antall = u16(d, eocd + 10);
  let peker = u32(d, eocd + 16);

  let start = -1, komp = -1, metode = 0, navnLen = 0, ekstraLen = 0;
  for(let i = 0; i < antall && peker + 46 <= n; i++){
    if(u32(d, peker) !== 0x02014b50) break;
    navnLen        = u16(d, peker + 28);
    const ekstra   = u16(d, peker + 30);
    const komment  = u16(d, peker + 32);
    const navn = new TextDecoder().decode(bytes.subarray(peker + 46, peker + 46 + navnLen));
    if(navn === 'word/document.xml'){
      metode = u16(d, peker + 10);
      komp   = u32(d, peker + 20);
      start  = u32(d, peker + 42);
      break;
    }
    peker += 46 + navnLen + ekstra + komment;
  }
  if(start < 0) throw new Error('Fant ingen tekst i dokumentet.');

  /* Den lokale posten har sine EGNE lengder paa navn og ekstrafelt - de
     er ikke alltid de samme som i sentralkatalogen, og bommer man her,
     starter dataene noen byte for tidlig. */
  if(u32(d, start) !== 0x04034b50) throw new Error('Dokumentet er skadet.');
  navnLen   = u16(d, start + 26);
  ekstraLen = u16(d, start + 28);
  const fra = start + 30 + navnLen + ekstraLen;

  const raa = await blaasOpp(bytes.subarray(fra, fra + komp), metode);
  return xmlTilTekst(new TextDecoder().decode(raa));
}

/* XML-en fra Word er avsnitt inne i celler inne i rader inne i tabeller.
   Rekkefoelgen det maa gjoeres i er ikke aapenbar: hver celle inneholder
   ET AVSNITT, saa bytter man </w:p> mot linjeskift foerst, brekker hver
   celle ut paa egen linje og tabellen faller fra hverandre.

   Loesningen er aa merke alle fire nivaaene - ogsaa TABELLEN selv - og
   sette sammen etterpaa. Uten tabellmerket maa man gjette paa hvor
   tabellen begynner ut fra hvor avsnittsmerkene staar, og den gjetningen
   er ikke til aa stole paa: en overskrift rett over tabellen og en tom
   foerste celle gir nesten samme moenster som en radnummercelle. Begge
   gjetningene ble proevd, og begge tok feil - den ene gjorde «1» til en
   overskrift, den andre limte tittelen inn i toppraden. */
const M_AVSNITT = '\u0001';
const M_CELLE   = '\u0002';
const M_RAD     = '\u0003';
const M_TAB_INN = '\u0004';
const M_TAB_UT  = '\u0005';

function xmlTilTekst(xml){
  const merket = xml
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    /* <w:tbl> og ikke <w:tblPr>: moensteret krever mellomrom eller > rett
       etter navnet, saa egenskapstaggene faller utenfor. */
    .replace(/<w:tbl(?:\s[^>]*)?>/g, M_TAB_INN)
    .replace(/<\/w:tbl>/g,  M_TAB_UT)
    .replace(/<\/w:p>/g,    M_AVSNITT)
    .replace(/<\/w:tc>/g,   M_CELLE)
    .replace(/<\/w:tr>/g,   M_RAD)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\u00a0/g, ' ');

  const linjer = [];

  function loependeTekst(bit){
    bit.split(M_AVSNITT).forEach(function(a){
      const t = a.replace(/\s+/g, ' ').trim();
      if(t) linjer.push(t);
    });
  }

  function tabell(bit){
    bit.split(M_RAD).forEach(function(rad){
      if(rad.indexOf(M_CELLE) === -1) return;      /* halen etter siste rad */
      const deler = rad.split(M_CELLE);
      /* Siste del er det som kom etter siste celle - alltid tomt. */
      const celler = deler.slice(0, -1).map(function(c){
        /* Flere avsnitt i én celle hoerer sammen paa én linje. */
        return c.split(M_AVSNITT).join(' ').replace(/\s+/g, ' ').trim();
      });
      /* Tomme celler i ENDEN baerer ingen betydning. Tomme celler MIDT i
         raden gjoer det - de holder kolonnene paa plass. */
      while(celler.length && !celler[celler.length - 1]) celler.pop();
      if(celler.length) linjer.push(celler.join(' | '));
    });
  }

  /* Vekselvis utenfor og inne i en tabell. Nostede tabeller finnes i Word,
     men er sjeldne i en ukeplan; her blir en indre tabell lest som rader i
     den ytre, og det er godt nok. */
  merket.split(M_TAB_INN).forEach(function(bolk, i){
    if(i === 0){ loependeTekst(bolk); return; }
    const to = bolk.split(M_TAB_UT);
    tabell(to[0]);
    if(to.length > 1) loependeTekst(to.slice(1).join(''));
  });

  return linjer.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ------------------------------------------------------------ */

async function hent(url){
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Neam/1.0 (familiehub; enkeltoppslag)' },
    cf: { cacheTtl: 300, cacheEverything: true }
  });
  if(!r.ok) throw new Error('Skolens side svarte ' + r.status);
  const buf = await r.arrayBuffer();
  if(buf.byteLength > MAKS) throw new Error('Fila er for stor.');
  return { bytes: new Uint8Array(buf), type: r.headers.get('content-type') || '' };
}

export async function onRequest(context){
  const inn = new URL(context.request.url);
  const hva = inn.searchParams.get('hva') || 'liste';

  try{
    if(hva === 'liste'){
      const r = await hent(SIDEN);
      const html = new TextDecoder('utf-8').decode(r.bytes);
      const lenker = lenkerFra(html);
      return svar({ kilde: SIDEN, antall: lenker.length, lenker: lenker });
    }

    if(hva === 'fil'){
      const bedt = inn.searchParams.get('url') || '';
      let mal;
      try{ mal = new URL(bedt); }
      catch(e){ return svar({ feil:'Ugyldig adresse.' }, 400); }
      /* Sperra. Ikke endsWith - «roligheden.skole.arendal.no.angriper.no»
         ville sluppet gjennom en slurvete sjekk. */
      if(mal.hostname.toLowerCase() !== VERT || !/^https?:$/.test(mal.protocol)){
        return svar({ feil:'Bare filer fra ' + VERT + ' kan hentes.' }, 403);
      }

      const r = await hent(mal.toString());
      const erDocx = /officedocument\.wordprocessingml/i.test(r.type)
                  || /\.docx(\?|$)/i.test(mal.pathname);
      if(!erDocx){
        return svar({ feil:'Fila er ikke en .docx. Åpne den i nettleseren og '
                         + 'lim inn teksten i stedet.', type:r.type }, 415);
      }
      const tekst = await docxTilTekst(r.bytes);
      return svar({ url: mal.toString(),
                    navn: decodeURIComponent(mal.pathname.split('/').pop() || ''),
                    tegn: tekst.length,
                    tekst: tekst });
    }

    return svar({ feil:'Ukjent forespørsel.' }, 400);

  }catch(e){
    return svar({ feil: (e && e.message) || 'Noe gikk galt.' }, 502);
  }
}
