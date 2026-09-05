/* ============================================================
   Neam - felles Graph-lag
   ------------------------------------------------------------
   Brukes av kalender og dashboard - de to sidene som snakker med
   Microsoft Graph. Trukket ut 28. august 2026 (7.3, fjerde
   flytting).

   De to versjonene hadde ulik signatur, ikke ulik oppgave:
   graph(sti, valg) mot graph(path, method, payload). Dashboards
   form vant - et valg-objekt taaler at det kommer en tredje ting
   en dag uten at signaturen maa endres igjen.

   Der oppfoerselen faktisk sprikte er unionen tatt, og hvert
   avvik er kommentert der det staar.

   FORVENTER av sida som laster fila:
     gyldigToken()  - skal gi et gyldig access token, eller null
     fargeOverstyring - fylles av sidens egen hentFarger()

   Lastes FOER sidens eget skript.
   ============================================================ */

const GRAPH = 'https://graph.microsoft.com/v1.0';
const TZ    = 'Europe/Oslo';

/* Id-ene fra Graph er base64-aktige og kan inneholde tegn som deler opp
   en URL-sti. Kalender limte dem rett inn en gang i tiden. */
const enc = encodeURIComponent;

/* Stien til én avtale.
   /me/events/{id} betyr "avtalen i MIN postkasse". Alle kalenderne bor paa
   sys og er delt derfra, saa for alle andre enn sys ligger avtalen i en
   annen postkasse enn deres egen - der finner ikke /me/events den, og Graph
   svarer "The specified object was not found in the store". Vi gaar derfor
   gjennom kalenderen avtalen ligger i, som er samme vei vi leser den ut.
   Riktig for sys ogsaa, saa det er én sti for alle. */
function avtaleSti(kalId, eventId){
  return kalId
    ? '/me/calendars/' + enc(kalId) + '/events/' + enc(eventId)
    : '/me/events/' + enc(eventId);
}

async function graph(sti, valg){
  const t = await gyldigToken();
  if(!t) throw new Error('Ikke innlogget');

  const opt = {
    method: (valg && valg.method) || 'GET',
    headers: {
      Authorization: 'Bearer ' + t,
      Prefer: 'outlook.timezone="' + TZ + '"'
    }
  };
  if(valg && valg.body){
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(valg.body);
  }

  /* Microsoft struper oss (429) naar flere kalendere hentes samtidig. Da
     venter vi tiden de ber om og proever igjen, i stedet for aa la en
     kalender falle ut av visningen.

     Kun for lesing. Dashboard proevde om igjen paa alt, ogsaa POST - og et
     nytt forsoek paa en POST som egentlig gikk gjennom lager avtalen to
     ganger. Kalenderens sperre er tatt med hit. */
  const kanProveIgjen = opt.method === 'GET';
  let forsok = 0;
  /* 429 kom i praksis foerst naar én bruker hadde sju kalendere og alle
     ble hentet samtidig. Gjenproevingen under henter den ene igjen; det
     som hindrer at det skjer er at kallstedene ikke fyrer av alt paa én
     gang - se kalenderhentingen i sidene. */
  let r;
  while(true){
    r = await fetch(GRAPH + sti, opt);
    if(!kanProveIgjen || forsok >= 3) break;
    if(r.status !== 429 && r.status !== 503 && r.status !== 504) break;
    const vent = parseInt(r.headers.get('Retry-After') || '', 10);
    const ms = (isFinite(vent) && vent > 0) ? Math.min(vent * 1000, 8000)
                                            : 500 * Math.pow(2, forsok);
    await new Promise(function(ok){ setTimeout(ok, ms); });
    forsok++;
  }

  if(r.status === 204) return null;                 // sletting gir tomt svar

  const txt = await r.text();
  if(!txt){
    if(r.ok) return null;
    /* Dashboards: et tomt svar som IKKE er ok er en feil, og den skal si
       hva den var. Kalenderen returnerte null her og lot feilen forsvinne
       i stillhet. */
    const stum = new Error('Microsoft svarte ' + r.status);
    stum.status = r.status;
    throw stum;
  }

  let d;
  try{ d = JSON.parse(txt); }catch(e){ throw new Error('Uventet svar fra Microsoft Graph'); }
  if(!r.ok){
    const feil = new Error((d.error && d.error.message) || 'Graph-feil');
    feil.status = r.status;      /* saa feilmeldinger kan si HVA som gikk galt */
    throw feil;
  }
  return d;
}

/* ============================================================
   Identitet
   ============================================================ */

/* Microsoft oppgir av og til gjeste-format som «magne_neam.no#EXT#@...».
   Vi normaliserer til vanlig e-post foer vi sammenligner identiteter. */
function normEpost(s){
  s = String(s || '').toLowerCase().trim();
  const ext = s.indexOf('#ext#');
  if(ext !== -1){
    s = s.slice(0, ext);
    const i = s.lastIndexOf('_');
    if(i !== -1) s = s.slice(0, i) + '@' + s.slice(i + 1);
  }
  return s;
}

/* ============================================================
   Farger
   ------------------------------------------------------------
   Selve hentingen fra KV blir liggende i sidene: kalenderen kan
   ogsaa skrive, og har FARGE_ADMIN og en lagreFarger() dashboard
   ikke har noe bruk for.
   ============================================================ */

let fargeOverstyring = {};   /* navn -> hex, fylles av sidens hentFarger() */

const PALETTE = ['#2C3E50','#B4443A','#3E7C5A','#8A6BB1','#C08A2E','#4A7FA8','#A05A7A','#5A6C7D'];

const FASTE_FARGER = {
  'Familie': '#2C3E50',
  'Magne'  : '#4A7FA8',
  'Nina'   : '#B4443A',
  'Emma'   : '#8A6BB1',
  'Andrea' : '#C65B7C'
};

/* Reservefargen naar ingen har valgt én. Utledes av navnet, ikke av
   plassen i kalenderlista: den plassen er forskjellig i hver postkasse -
   sys har flere kalendere og i annen rekkefoelge enn kitchen - og samme
   kalender fikk derfor ulik farge hos ulike folk. Navnet er likt overalt.
   Enkel deterministisk sum; den skal bare vaere stabil, ikke jevn. */
function palettFor(navn){
  const s = String(navn || '');
  let sum = 0;
  for(let i = 0; i < s.length; i++) sum = (sum * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[sum % PALETTE.length];
}

function kalenderFarge(navn){
  return fargeOverstyring[navn] || FASTE_FARGER[navn] || palettFor(navn);
}

function rgbAv(hex){
  const h = String(hex || '').replace('#', '').trim();
  const full = h.length === 3 ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2] : h;
  if(!/^[0-9a-fA-F]{6}$/.test(full)) return {r:44, g:62, b:80};   /* faller tilbake paa blekk */
  return {
    r: parseInt(full.slice(0,2),16),
    g: parseInt(full.slice(2,4),16),
    b: parseInt(full.slice(4,6),16)
  };
}

function dus(hex, a){
  const c = rgbAv(hex);
  return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
}

/* ============================================================
   Tekst
   ============================================================ */

/* Graph gir notatfeltet som HTML naar type sier 'html'. Blokkene faar et
   linjeskift bak seg foer teksten hentes ut, ellers klistrer avsnittene
   seg sammen. */
function htmlTilTekst(innhold, type){
  const s = String(innhold || '');
  if(!s) return '';
  if(String(type).toLowerCase() !== 'html') return s.trim();
  try{
    const doc = new DOMParser().parseFromString(s, 'text/html');
    doc.querySelectorAll('br').forEach(function(b){ b.replaceWith('\n'); });
    doc.querySelectorAll('p,div,li,tr,h1,h2,h3,h4,h5,h6').forEach(function(b){
      b.append('\n');
    });
    return (doc.body.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }catch(e){
    /* Reserve om DOMParser ikke er tilgjengelig: gjoer blokkslutt til
       linjeskift foer taggene fjernes, ellers klistres avsnitt sammen. */
    return s.replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
  }
}

/* ============================================================
   Flytting mellom kalendere
   ------------------------------------------------------------
   Graph kan ikke flytte en avtale. Vi lager den paa nytt i
   maalkalenderen, tar med vedleggene, og sletter originalen
   til slutt - i den rekkefoelgen, saa ingenting forsvinner om
   noe ryker underveis.

   Fungerer bare paa en enkeltstaaende avtale. En enkeltdag kan
   ikke loeftes ut av en serie, og kallstedet maa sperre for det.

   Alle vedlegg blir med. Skal noen bort, skal de slettes fra
   originalen FOER dette kallet - da slipper vi aa sende med en
   liste over id-er som kan ha blitt ugyldige siden skjemaet ble
   aapnet, slik de erfaringsmessig blir.
   ============================================================ */
async function flyttAvtale(fraKalId, eventId, tilKalId, kropp){
  const ny = await graph('/me/calendars/' + enc(tilKalId) + '/events',
                         {method:'POST', body:kropp});
  if(!ny || !ny.id) throw new Error('Den nye avtalen ble ikke opprettet');

  /* Lista hentes paa nytt her, ikke fra skjemaet: id-ene fra da dialogen
     ble aapnet kan ha gaatt ut paa dato. */
  let liste = [];
  try{
    const d = await graph(avtaleSti(fraKalId, eventId) + '/attachments?$select=id,name,contentType');
    liste = (d && d.value) || [];
  }catch(e){ /* ingen vedlegg aa hente - flyttingen skal ikke stoppe av det */ }

  for(const v of liste){
    /* Et vedlegg kan ogsaa vaere en avtale eller en e-post. Bare vanlige
       filvedlegg kan kopieres. */
    const type = String(v['@odata.type'] || '');
    if(type && type.indexOf('fileAttachment') === -1) continue;
    const full = await graph(avtaleSti(fraKalId, eventId) + '/attachments/' + enc(v.id));
    if(!full || !full.contentBytes) continue;
    await graph(avtaleSti(tilKalId, ny.id) + '/attachments', {method:'POST', body:{
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: full.name || v.name,
      contentType: full.contentType || 'application/octet-stream',
      contentBytes: full.contentBytes
    }});
  }

  await graph(avtaleSti(fraKalId, eventId), {method:'DELETE'});
  return ny.id;
}
