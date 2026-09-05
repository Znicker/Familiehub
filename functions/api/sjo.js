/* ============================================================
   /api/sjo - sjoetemperaturen ved Floedevigen
   ------------------------------------------------------------
   Cloudflare Pages Function. Ligger i repoet som
   functions/api/sjo.js og svarer paa /api/sjo.

   HVORFOR SERVERSIDEN: samme grunn som skolens side - imr.no
   sender ingen CORS-hoder, saa nettleseren faar ikke hente selv.

   HVA DEN GIR:
     { temp: 16.7, dybde: 1, tid: "2026-09-05T06:00:00+02:00",
       kilde: "..." }
   eller { feil: "..." } naar den ikke finner et tall.

   HVOR TALLET KOMMER FRA: sida draw.map?boey=1 laster tabellen
   «Sjoemaalinger» med JavaScript ETTER at HTML-en er levert, saa
   selve HTML-en har ingen tall i seg. Skriptet henter dem fra
   et eget endepunkt, og det er DET vi maa spoerre. Adressen
   staar i KILDE under. Er den feil, svarer funksjonen med
   {feil} og sier hva den faktisk fikk - se `start` i svaret -
   slik at riktig adresse kan settes inn uten aa gjette.

   Svaret mellomlagres i en time hos Cloudflare (cacheTtl). Boeyen
   maaler noen ganger i doegnet, og hver skjerm i huset som vaakner
   skal ikke bli et nytt besoek hos HI.

   VERTEN ER LAAST til imr.no, som for skolen.
   ============================================================ */

const VERT  = 'www.imr.no';
/* Dataendepunktet sida selv henter tabellen fra - funnet i Network-fanen
   5. september 2026: updateLatest.js kaller updateLastReadings.ajx og
   faar 1,1 kB tilbake. draw.map, som var foerste gjetning, er bare
   visningssida og har ingen tall i seg. */
const KILDE = 'https://www.imr.no/forskning/forskningsdata/temperatur_flodevigen/updateLastReadings.ajx?boey=1';
/* Sida endepunktet hoerer til. Sendes som Referer, og hentes foerst hvis
   endepunktet krever en sesjonskake. */
const SIDEN = 'https://www.imr.no/forskning/forskningsdata/temperatur_flodevigen/draw.map?boey=1';
const DYBDE = 1;        /* meter - badetemperaturen */

function svar(obj, status){
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      /* Nettleseren skal spoerre hver gang den vaakner; det er
         Cloudflare som holder svaret varmt mellom besoekene. */
      'Cache-Control': 'no-store'
    }
  });
}

/* ------------------------------------------------------------
   Tolkning. To former stoettes:

   1) JSON fra et dataendepunkt. Vi leter etter noe som ser ut
      som en maaling paa DYBDE meter: et objekt med et dybdefelt
      og et temperaturfelt, eller en rad i en tabell-liknende
      struktur. Feltnavnene er ukjente foer endepunktet er sett,
      saa vi proever de vanlige.

   2) HTML med tabellen «Sjoemaalinger»: rader med
      Dybde | Temperatur | Saltholdighet | ..., og et tidspunkt
      i teksten over («... lokal tid»).
   ------------------------------------------------------------ */

function tall(s){
  const t = parseFloat(String(s).replace(',', '.'));
  return isFinite(t) ? t : null;
}

function fraJson(d){
  /* Flat liste av kandidater: alle objekter i strukturen. */
  const alle = [];
  (function gaa(x, dyp){
    if(!x || dyp > 6) return;
    if(Array.isArray(x)){ x.forEach(function(y){ gaa(y, dyp+1); }); return; }
    if(typeof x === 'object'){ alle.push(x); Object.keys(x).forEach(function(k){ gaa(x[k], dyp+1); }); }
  })(d, 0);
  const dybdeNavn = ['dybde','depth','dyp','z','level'];
  const tempNavn  = ['temperatur','temperature','temp','t','sjotemp','verdi','value'];
  const tidNavn   = ['tid','time','timestamp','dato','date','datetime','maalt','measured'];
  for(const o of alle){
    const dk = dybdeNavn.find(function(k){ return k in o; });
    const tk = tempNavn.find(function(k){ return k in o; });
    if(!dk || !tk) continue;
    if(Math.abs((tall(o[dk]) || 0) - DYBDE) > 0.6) continue;
    const temp = tall(o[tk]);
    if(temp === null || temp < -3 || temp > 35) continue;
    const tidk = tidNavn.find(function(k){ return k in o; });
    return { temp: temp, dybde: DYBDE, tid: tidk ? String(o[tidk]) : null };
  }
  return null;
}

function fraHtml(html){
  const tekst = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
  /* Raden for 1.0 m: «1.0 16.70 32.66 ...» etter at taggene er borte. */
  const rad = new RegExp('(?:^|\\s)' + DYBDE + '[.,]0\\s+(-?\\d{1,2}[.,]\\d{1,2})\\s+\\d{1,2}[.,]\\d').exec(tekst);
  if(!rad) return null;
  const temp = tall(rad[1]);
  if(temp === null) return null;
  /* Tidspunktet: «dd.mm.yyyy hh:mm lokal tid» eller «... kl hh:mm». */
  let tid = null;
  const t1 = /(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})\D{0,8}(\d{1,2})[:.](\d{2})/.exec(tekst);
  if(t1){
    const [_, d, m, y, h, mi] = t1;
    tid = y + '-' + m.padStart(2,'0') + '-' + d.padStart(2,'0') + 'T' + h.padStart(2,'0') + ':' + mi + ':00';
  }
  return { temp: temp, dybde: DYBDE, tid: tid };
}

/* Endepunktet svarte 404 paa et vanlig GET, men 200 til sidas eget skript.
   Da ser tjeneren paa HVEM som spoer. Vi proever det skriptet gjoer, i
   stigende grad av innsats:

     1. GET med X-Requested-With og Referer  (det jQuery legger paa)
     2. POST med det samme                    (ajaxfunctions kan bruke POST)
     3. Hent sida foerst, ta med kaka, og proev 1 og 2 igjen

   Det som virket staar i `via` i svaret, saa vi kan stramme inn til
   bare det senere. */
const HODER = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36',
  'Accept': 'text/html, */*; q=0.01',
  'Accept-Language': 'nb-NO,nb;q=0.9,no;q=0.8,en;q=0.7',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': SIDEN
};

async function proev(url, metode, kake){
  const h = Object.assign({}, HODER);
  if(kake) h['Cookie'] = kake;
  if(metode === 'POST') h['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
  const r = await fetch(url, {
    method: metode, headers: h, redirect: 'follow',
    body: metode === 'POST' ? '' : undefined,
    cf: { cacheTtl: 3600, cacheEverything: metode === 'GET' }
  });
  const tekst = await r.text();
  return { ok: r.ok, status: r.status, tekst: tekst,
           type: r.headers.get('content-type') || '' };
}

async function hent(url){
  const forsok = [];
  let svar = await proev(url, 'GET', null);
  forsok.push('GET ' + svar.status);
  if(svar.ok) return Object.assign(svar, { via: forsok.join(', ') });

  svar = await proev(url, 'POST', null);
  forsok.push('POST ' + svar.status);
  if(svar.ok) return Object.assign(svar, { via: forsok.join(', ') });

  /* Sesjonskake: hent sida, plukk cookien, proev igjen. */
  const side = await fetch(SIDEN, { headers: { 'User-Agent': HODER['User-Agent'] }, redirect: 'follow' });
  const kake = (side.headers.get('set-cookie') || '').split(',')
                 .map(function(c){ return c.split(';')[0].trim(); })
                 .filter(Boolean).join('; ');
  forsok.push('side ' + side.status + (kake ? ' +kake' : ' uten kake'));
  if(kake){
    svar = await proev(url, 'GET', kake);
    forsok.push('GET+kake ' + svar.status);
    if(svar.ok) return Object.assign(svar, { via: forsok.join(', ') });
    svar = await proev(url, 'POST', kake);
    forsok.push('POST+kake ' + svar.status);
    if(svar.ok) return Object.assign(svar, { via: forsok.join(', ') });
  }
  throw new Error('imr.no svarte ' + svar.status + ' (' + forsok.join(', ') + ')');
}

export async function onRequest(context){
  const inn = new URL(context.request.url);
  /* ?url= lar en proeve et annet endepunkt uten aa deploye - men bare
     paa imr.no. Naar riktig adresse er funnet, skrives den inn i KILDE. */
  const bedt = inn.searchParams.get('url');
  let mal = KILDE;
  if(bedt){
    try{
      const u = new URL(bedt);
      if(u.hostname.toLowerCase() !== VERT || !/^https?:$/.test(u.protocol)){
        return svar({ feil:'Bare ' + VERT + ' kan hentes.' }, 403);
      }
      mal = u.toString();
    }catch(e){ return svar({ feil:'Ugyldig adresse.' }, 400); }
  }

  try{
    const r = await hent(mal);
    let ut = null;
    if(/json/i.test(r.type) || /^\s*[\[{]/.test(r.tekst)){
      let d = null;
      try{ d = JSON.parse(r.tekst); }catch(e){}
      if(d) ut = fraJson(d);
    }
    if(!ut) ut = fraHtml(r.tekst);
    if(!ut){
      /* Sier hva vi fikk, saa riktig endepunkt kan finnes uten gjetting.

         STATUS 200, ikke 502. Svarer en Pages Function med 502, setter
         Cloudflare inn sin egen «Bad gateway»-side i stedet for kroppen
         vaar - og hele diagnosen forsvinner. Det var det som skjedde:
         sida viste Cloudflares feilside, og `start` kom aldri fram.
         Klienten ser paa om `temp` finnes, ikke paa statuskoden, saa 200
         med {feil} haandteres riktig - feltet blir tomt. */
      return svar({
        feil: 'Fant ingen maaling paa ' + DYBDE + ' m i svaret.',
        kilde: mal, via: r.via, type: r.type, tegn: r.tekst.length,
        start: r.tekst.replace(/\s+/g, ' ').slice(0, 400)
      });
    }
    ut.kilde = mal;
    ut.via = r.via;
    return svar(ut);
  }catch(e){
    /* Samme grunn: 200 med {feil}, saa meldingen kommer fram. */
    return svar({ feil: (e && e.message) || 'Noe gikk galt.', kilde: mal });
  }
}
