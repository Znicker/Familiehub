/* ============================================================
   Neam - samtaleflaten (oppfoersel)
   ------------------------------------------------------------
   Haandtaket, panelet, samtalen og verktoeyloekka mot
   /api/claude. Laget 28. august 2026; verktoey lagt til samme dag.

   Fila monterer seg selv. Sida trenger bare aa laste den - ingen
   markup, ingen oppstartskall.

   ------------------------------------------------------------
   KONTRAKTEN MOT SIDA - tre funksjoner, alle valgfrie

     window.neamKontekst = async function(){ ... };
     window.neamBakgrunn = async function(){ ... };
     window.neamVerktoy  = async function(){ ... };
     window.neamUtfor    = async function(navn, arg){ ... };

   ALLE ER ASYNKRONE MED VILJE, ogsaa de som svarer med én gang i
   dag. Skal panelet en gang ligge i en ramme (hub.html), gaar
   spoersmaalene over en dokumentgrense og maa gaa via
   postMessage - og et svar som kommer tilbake senere kan ikke
   returneres synkront. Skrives kallstedene med await naa, merker
   de flyttingen overhodet ikke.

   neamKontekst() - "hvor er jeg og hva ser jeg paa". Feltene er
   frie; alt sendes med som JSON i systemteksten. Bare `sted` og
   `visning` leses her, og bare for aa skrives ut i topplinja.

   neamBakgrunn() - hvordan denne appen henger sammen, som fri tekst.
   Begrepene, reglene og vanene Neam ellers maatte gjettet seg til.
   Skrevet én gang og lagt til systemteksten hver gang. Kontekst
   svarer paa hva som er sant NAA; bakgrunn paa hva som alltid er
   sant. Blandes de, blir det uklart hva som maa oppdateres naar
   noe endrer seg.

   neamVerktoy() - lista over hva som kan gjoeres PAA DENNE SIDA.
   Vanlige verktoeydefinisjoner (name, description, input_schema)
   pluss to felter som er vaare egne og strippes foer sending:

     neamSkriver  true naar verktoeyet endrer noe. Da spoer
                  panelet foerst, og gjoer ingenting uten ja.
     neamBeskriv  function(arg) -> setning som forklarer hva som
                  kommer til aa skje. Vises i bekreftelsen.
     neamTabell   function(arg) -> flere forslag lagt fram under
                  ett, med avkryssing per rad, tegnet i panelet.
     neamSkjerm   async function(arg) -> sida tegner sin EGEN
                  skjerm og svarer med det brukeren bestemte.
                  Panelet gjemmer seg mens den staar. Svaret
                  legges oppaa arg-ene foer neamUtfor kalles;
                  null betyr at brukeren gikk ut uten aa velge.
                  Brukes naar en tabell i et smalt panel er for
                  lite - da hoerer flata hjemme i sida.

   neamUtfor(navn, arg) - kjoerer verktoeyet og returnerer noe som
   taaler JSON.stringify. Kaster den, gaar feilen tilbake til Neam
   som et feilresultat, ikke til brukeren som en krasj.

   Mangler funksjonene, virker panelet fortsatt - Neam kan bare
   ikke se hvor du er eller gjoere noe.

   ANDRE VEIEN kan sida starte en samtale selv:

     await neamStart('...', {friskt:true, modell:'sonnet',
                             verktoy:['finn_opprydding','slaa_sammen']});

   `verktoy` begrenser hvilke verktoey oppgaven faar se, og gjelder
   bare den ene turen.

   Se kommentaren over funksjonen.
   ------------------------------------------------------------

   NETTSOEK er alltid paa. Det kjoeres av API-et selv, ikke av oss,
   saa det trenger ingen kontrakt og ingen godkjenning - et soek
   endrer ingenting. Systemteksten ber ham holde seg til dataene
   sine der de raekker.

   REGELEN: lesing gaar rett gjennom, skriving stopper og spoer.
   Spoer du hva som staar paa lista, skal ikke Neam be om lov til
   aa se etter. Skal han endre noe, ser du hva som kommer til aa
   skje foer det skjer.

   Samtalen ligger i sessionStorage, ikke i KV eller localStorage.
   Den skal overleve at du gaar fra handlelista til kalenderen, og
   doe naar du lukker fana. Samme vurdering som kalenderens
   hurtigvalg - en samtale som overlever oekta blir en samtale du
   ikke husker at du startet.

   FORVENTER av sida som laster fila:
     bekreft()  - fra felles-dialog.js, som maa lastes FOER denne

   Lastes FOER sidens eget skript.
   ============================================================ */

const NEAM_LAGER  = 'neam_samtale';
const NEAM_MERKE  = '/bilder/merke-neam.png';
/* Modellene man kan veksle mellom, i rekkefoelge fra raskest til
   grundigst. Knappen i topplinja gaar rundt.

   Farten er utskriving, ikke venting: rundt 200 tokens i sekundet paa
   Sonnet, saa et langt svar tar tjue sekunder uansett hvor lite som
   skjer. Haiku skriver fortere og holder lenge til aa lese en liste og
   finne dubletter. Opus er for naar svaret betyr mer enn sekundene. */
const NEAM_MODELLER = [
  { id:'claude-haiku-4-5-20251001', navn:'Haiku'  },
  { id:'claude-sonnet-5',           navn:'Sonnet' },
  { id:'claude-opus-5',             navn:'Opus'   }
];
const NEAM_MODELL_LAGER = 'neam_modell';

/* Modellen en OPPGAVE har bedt om, satt av neamStart({modell:'sonnet'}).

   Knappen i topplinja er hva brukeren prater med. En oppgave sida starter
   er noe annet: den vet hva den krever, og skal ikke faa Haiku fordi noen
   satte den til noe raskt for aa slaa av en prat i gaar. Derfor overstyrer
   oppgaven knappen - men den VISES i knappen, saa det aldri staar ett navn
   mens et annet svarer.

   Nullstilles av «Ny samtale» og av friskt:true: da er oppgaven over. */
let neamPaatvunget = null;

/* Verktoeyene en OPPGAVE skal ha, satt av neamStart({verktoy:[...]}).

   Gjelder bare turen oppgaven starter, og nullstilles naar den er over.
   Grunnen: en gjennomgang skal legge alt fram paa én skjerm, men saa lenge
   fjern_varer og endre_vare ligger i lista, tar modellen dem én om gangen -
   og da kommer det en dialog per vare. Det er ikke noe man skriver seg ut
   av i en instruks; verktoeyet maa ikke vaere der.

   Etterpaa, naar brukeren skriver selv, er hele lista tilbake: da ER det
   én bestemt endring han ber om. */
let neamTurVerktoy = null;

function neamModellId(navn){
  const s = String(navn || '').toLowerCase();
  const m = NEAM_MODELLER.find(function(x){ return x.navn.toLowerCase() === s || x.id === navn; });
  return m ? m.id : null;
}

/* localStorage, ikke sessionStorage som samtalen: dette er en innstilling,
   ikke en del av en samtale, og den staar skrevet i topplinja hele tiden.
   Det som huskes uten aa vises er det som blir et problem. */
function neamModell(){
  let valgt = neamPaatvunget;
  if(!valgt){ try{ valgt = localStorage.getItem(NEAM_MODELL_LAGER); }catch(e){} }
  return NEAM_MODELLER.find(function(m){ return m.id === valgt; }) || NEAM_MODELLER[1];
}

function neamNesteModell(){
  const naa = neamModell();
  const i = NEAM_MODELLER.findIndex(function(m){ return m.id === naa.id; });
  const ny = NEAM_MODELLER[(i + 1) % NEAM_MODELLER.length];
  try{ localStorage.setItem(NEAM_MODELL_LAGER, ny.id); }catch(e){}
  return ny;
}

/* Hvor mye av samtalen som sendes med. Hele historikken gaar med i
   hvert kall - API-et husker ingenting selv - saa dette er baade et
   kostnadstak og et tak paa hvor langt tilbake Neam ser. */
const NEAM_SENDT  = 24;
const NEAM_LAGRET = 60;

/* Tak paa hvor mange ganger Neam faar kalle verktoey for én melding.
   Uten det kan en modell som misforstaar staa og kalle det samme om
   igjen til noen lukker fana. */
const NEAM_MAKS_RUNDER = 6;

/* Postene er enten en ekte API-melding eller vaar egen feilmelding.
   API-meldingene lagres slik de sendes - med verktoeyblokkene i - saa
   historikken kan spilles av igjen etter en sideveksling uten at
   paret tool_use/tool_result gaar i stykker. */
let neamPoster = [];
let neamVenter = false;
let neamBygd = false;

/* ============================================================
   Lagring
   ============================================================ */

function neamHent(){
  try{
    const s = sessionStorage.getItem(NEAM_LAGER);
    const d = s ? JSON.parse(s) : null;
    return Array.isArray(d) ? d : [];
  }catch(e){ return []; }
}

function neamLagre(){
  try{
    sessionStorage.setItem(NEAM_LAGER, JSON.stringify(neamPoster.slice(-NEAM_LAGRET)));
  }catch(e){ /* full eller avslaatt - samtalen lever ut sida uansett */ }
}

/* ============================================================
   Historikken som sendes
   ============================================================ */

/* Et tool_result maa ha sitt tool_use rett foran seg. Klipper vi blindt
   paa antall, kan vi ende opp med aa sende et resultat uten kallet det
   svarer paa, og API-et avviser hele meldingen. Vi klipper derfor bare
   der en ekte brukertur begynner. Finner vi ikke et slikt sted, sender
   vi heller for mye enn noe oedelagt. */
function neamKlipp(msgs){
  if(msgs.length <= NEAM_SENDT) return msgs;
  for(let i = msgs.length - NEAM_SENDT; i < msgs.length; i++){
    if(msgs[i].role === 'user' && typeof msgs[i].content === 'string') return msgs.slice(i);
  }
  return msgs;
}

/* Reparerer et tool_use som aldri fikk sitt tool_result.

   API-et krever at hvert kall har et svar i meldingen rett etter. Mangler
   ett, avvises HELE samtalen - ikke bare det neste kallet, men alt videre,
   ogsaa etter en ny innlasting, siden historikken ligger i sessionStorage.
   Samtalen blir da uopprettelig uten «Ny samtale».

   Det kan skje paa tre maater, og alle tre har vi sett eller kan se:
   - taket paa antall runder slaar inn etter at kallene er lagt inn
   - noe kaster mellom kallet og svarene
   - fana lukkes midt i en runde

   Vi fyller derfor inn manglende svar med en beskjed om at kallet ble
   avbrutt. Neam faar vite at det ikke ble noe av, og samtalen kan gaa
   videre i stedet for aa staa laast. */
function neamReparer(){
  const ut = [];
  for(let i = 0; i < neamPoster.length; i++){
    const p = neamPoster[i];
    ut.push(p);
    if(!p.api || p.api.role !== 'assistant' || !Array.isArray(p.api.content)) continue;

    const kall = p.api.content.filter(function(b){ return b.type === 'tool_use'; });
    if(!kall.length) continue;

    const neste = neamPoster[i + 1];
    const svar = (neste && neste.api && neste.api.role === 'user'
                  && Array.isArray(neste.api.content)) ? neste.api.content : null;
    const sett = new Set((svar || [])
      .filter(function(b){ return b.type === 'tool_result'; })
      .map(function(b){ return b.tool_use_id; }));

    const mangler = kall.filter(function(b){ return !sett.has(b.id); })
      .map(function(b){
        return { type:'tool_result', tool_use_id:b.id, is_error:true,
                 content:'Avbrutt - verktøyet ble aldri kjørt.' };
      });
    if(!mangler.length) continue;

    /* Finnes svarmeldingen alt, men er ufullstendig, fylles den ut.
       Ellers skytes en ny inn foer det som kommer etter. */
    if(svar) svar.push.apply(svar, mangler);
    else ut.push({ api:{ role:'user', content:mangler } });
  }
  neamPoster = ut;
}

function neamHistorikk(){
  return neamKlipp(neamPoster.filter(function(p){ return p.api; })
                             .map(function(p){ return p.api; }));
}

/* ============================================================
   Konteksten
   ============================================================ */

/* Sida svarer, eller den gjoer det ikke. En side uten kontrakt, en
   kontrakt som kaster, en kontrakt som aldri svarer - alle tre gir
   null, og panelet gaar videre uten. Neam skal ikke kunne henge paa
   at en side svarer daarlig. */
async function neamSpor(navn, arg){
  if(typeof window[navn] !== 'function') return null;
  try{
    return await Promise.race([
      Promise.resolve(window[navn](arg)),
      new Promise(function(ok){ setTimeout(function(){ ok(null); }, 2000); })
    ]);
  }catch(e){
    console.warn(navn + '() feilet:', e);
    return null;
  }
}

async function neamSted(){
  const svar = await neamSpor('neamKontekst');
  return (svar && typeof svar === 'object') ? svar : null;
}

async function neamBakgrunn(){
  const svar = await neamSpor('neamBakgrunn');
  return (typeof svar === 'string') ? svar.trim() : '';
}

async function neamVerktoyliste(){
  const svar = await neamSpor('neamVerktoy');
  const alle = Array.isArray(svar) ? svar : [];
  if(!neamTurVerktoy) return alle;
  const bare = alle.filter(function(v){ return neamTurVerktoy.indexOf(v.name) !== -1; });
  /* Traff filteret ingenting, er navnene feil - da er hele lista bedre enn
     ingen verktoey i det hele tatt. */
  return bare.length ? bare : alle;
}

function neamStedTekst(k){
  if(!k) return '';
  return [k.sted, k.visning].filter(Boolean).join(' \u00B7 ');
}

function neamSystem(k, harVerktoy, bakgrunn){
  let s =
    'Du er Neam, husassistenten i familiens hub. Du svarer paa norsk (bokmaal), ' +
    'kort og konkret. Familien er Magne, Nina, Emma og Andrea.\n\n';

  if(harVerktoy){
    s += 'Du har verktoey for denne sida. Bruk dem heller enn aa gjette - vet du ' +
         'ikke hva som staar paa en liste, saa les den. Verktoey som endrer noe ' +
         'blir lagt fram for brukeren foer de kjoerer; avslaar brukeren, godtar ' +
         'du det og foreslaar noe annet.\n\n' +
         'Du har ingen andre veier inn i systemet enn verktoeyene. Finnes det ' +
         'ikke et som passer, si det - ikke lat som om noe er gjort.\n\n' +
         'Ta avgjoerelsene du kan ta selv. Spoer bare naar det finnes et ekte ' +
         'valg som du ikke kan ta paa brukerens vegne - hva som faktisk trengs, ' +
         'om noe skal vekk. Ting som foelger av regler eller av det du alt vet, ' +
         'gjoer du uten aa spoerre. Har et verktoey en tabell, legg alt fram i ' +
         'den ene i stedet for aa spoerre om ett og ett.\n\n' +
         'Kall hvert verktoey saa faa ganger som mulig. Merker du at du er i ' +
         'ferd med aa kalle det samme verktoeyet én gang per rad eller per vare, ' +
         'saa stopp: da mangler svaret du trenger i dataene du alt har faatt, ' +
         'og det er noe brukeren maa vite om. Si hva du manglet i stedet for aa ' +
         'gaa rundt det.\n\n';
  }else{
    s += 'Du har ingen verktoey paa denne sida. Du kan bare snakke. Blir du bedt ' +
         'om aa gjoere noe, si hva du ville gjort og at det ikke er koblet paa ' +
         'her ennaa. Ikke lat som om noe er utfoert.\n\n';
  }

  s += 'Du kan soeke paa nettet. Bruk det sparsomt, og bare naar svaret ' +
       'hverken staar i dataene du har faatt eller er noe du vet fra foer - ' +
       'typisk noe du ikke kjenner igjen, eller noe som endrer seg. Slaa ALDRI ' +
       'opp husets egne ting paa nettet: hva som staar paa lista, hva familien ' +
       'pleier aa kjoepe eller hva noe heter hos dem, finnes bare her.\n\n';

  s += 'Ikke gjett paa hva som staar i listene eller kalenderen.';

  /* Bakgrunnen foerst, saa konteksten: det som alltid er sant staar
     over det som er sant akkurat naa. */
  if(bakgrunn) s += '\n\n--- Om denne appen ---\n' + bakgrunn;

  s += k ? ('\n\nHer staar brukeren akkurat naa:\n' + JSON.stringify(k, null, 1))
         : '\n\nDu vet ikke hvilken side brukeren staar paa.';
  return s;
}

/* ============================================================
   Kallet
   ============================================================ */

/* Svaret leses som tekst foer det tolkes som JSON. Gaar tjenesten ned,
   kommer det en HTML-side eller en tom kropp i retur, og response.json()
   kaster da en melding som ikke sier noe om hva som skjedde. Samme
   laerdom som i oppskrifter. */
async function neamEttForsok(meldinger, system, verktoy){
  const kropp = {
    model: neamModell().id,
    max_tokens: 4000,

    /* Utvidet tenkning AV.

       Dette var hele forklaringen paa tregheten. Modellen tenkte i 28 000
       tegn - rundt 7000 tokens - foer den begynte aa skrive, og traff taket
       midt i tenkningen. Resultatet var et panel som sto i tretti sekunder
       og saa ga en feilmelding: alt budsjettet gikk med, ingenting kom ut.

       Aa heve taket gjoer det bare tregere. Oppgavene her - les en liste,
       finn dubletter, foreslaa en sum - trenger ikke et resonnement paa
       flere tusen ord.

       Skulle en tyngre oppgave trenge det en dag, hoerer det hjemme som et
       valg pr. oppgave, ved siden av modellvalget - ikke som noe som staar
       paa hele tiden uten at noen har bestemt det. */
    thinking: { type: 'disabled' },
    /* NB: ikke sett temperature - modellen avviser den. */
    system: system,
    messages: meldinger
  };
  /* Vaare egne felter foelger ikke med ut - API-et avviser ukjente
     noekler i en verktoeydefinisjon. */
  const ut = verktoy.map(function(v){
    return { name:v.name, description:v.description, input_schema:v.input_schema };
  });

  /* Nettsoek kjoeres av API-et selv, ikke av oss: svaret kommer tilbake i
     samme runde som server_tool_use og web_search_tool_result, og
     stop_reason blir 'end_turn'. Loekka vaar merker det ikke - den ser
     bare etter 'tool_use', som er vaare egne verktoey.

     max_uses er et tak paa hvor mange soek han faar gjoere per melding.
     Hvert soek er sekunder, og et panel som staar og leter i et halvt
     minutt er ikke til hjelp. */
  ut.push({ type:'web_search_20250305', name:'web_search', max_uses:3 });
  kropp.tools = ut;

  /* Et kall uten tak kan bli haengende for alltid, og da staar «Neam
     tenker …» til noen laster sida paa nytt. Med tenkningen av er et
     svar sjelden over ti sekunder; ett minutt er rikelig, og det som
     tar lenger tid kommer ikke. */
  const stopper = new AbortController();
  const klokke = setTimeout(function(){ stopper.abort(); }, 60000);

  let r;
  try{
    r = await fetch('/api/claude', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(kropp),
      signal: stopper.signal
    });
  }catch(e){
    const brutt = (e && e.name === 'AbortError');
    const feil = new Error(brutt
      ? 'Neam svarte ikke innen ett minutt. Prøv igjen, eller be om mindre av gangen.'
      : 'Fikk ikke kontakt med Neam. Sjekk nettforbindelsen.');
    feil.kanProvesIgjen = !brutt;   /* et nytt forsoek som ogsaa tar for lang tid hjelper ingen */
    throw feil;
  }finally{
    clearTimeout(klokke);
  }

  const raa = await r.text();
  if(!raa.trim()){
    const feil = new Error('Neam svarte tomt (HTTP ' + r.status + ').');
    feil.kanProvesIgjen = true;
    throw feil;
  }

  let d;
  try{ d = JSON.parse(raa); }
  catch(e){
    const feil = new Error('Uventet svar fra tjenesten (HTTP ' + r.status + ').');
    feil.kanProvesIgjen = r.status === 429 || r.status >= 500;
    throw feil;
  }

  if(!r.ok || d.type === 'error'){
    const feil = new Error((d.error && d.error.message) || ('HTTP ' + r.status));
    feil.kanProvesIgjen = r.status === 429 || r.status >= 500;
    throw feil;
  }
  return d;
}

/* Ett nytt forsoek ved forbigaaende feil. Ekte feil fra API-et proeves
   ikke om igjen - da er svaret det samme neste gang. */
async function neamKall(meldinger, system, verktoy){
  try{
    return await neamEttForsok(meldinger, system, verktoy);
  }catch(e){
    if(!e.kanProvesIgjen) throw e;
    await new Promise(function(ok){ setTimeout(ok, 1200); });
    return await neamEttForsok(meldinger, system, verktoy);
  }
}

/* ============================================================
   Verktoey
   ============================================================ */

/* ============================================================
   Tabellen
   ------------------------------------------------------------
   Et verktoey kan legge fram flere forslag paa én gang i stedet
   for aa spoerre om ett og ett:

     neamTabell: function(arg){
       return {
         tittel: 'Forslag til opprydding',
         kolonner: ['Vare', 'Forslag'],
         rader: [{ id:'0', celler:['Potet', 'slås sammen til 2,6 kg'],
                   hvorfor:'står på to rader', valgt:true }]
       };
     }

   Panelet tegner den i samtalen med avkryssing per rad. Brukeren
   huker av det han vil ha, trykker én gang, og de valgte id-ene
   sendes til neamUtfor som `valgte`.

   Ti dialoger etter hverandre er ti avgjoerelser tatt uten
   oversikt. Én tabell er den samme informasjonen der man kan se
   den under ett - og for Neam er det ett verktoeykall i stedet
   for ti, som ogsaa er der sekundene ligger.
   ============================================================ */

let neamTabellSvar = null;   /* resolve for tabellen som staar oppe */
let neamTabellEl  = null;   /* selve elementet, saa det kan settes tilbake */

function neamTabellAvbryt(){
  const f = neamTabellSvar;
  neamTabellSvar = null;
  neamTabellEl = null;
  if(f) f(null);
}

function neamVisTabell(spek){
  const boks = document.getElementById('neamSamtale');
  if(!boks) return Promise.resolve(null);

  const ramme = document.createElement('div');
  ramme.className = 'neam-tabell';

  if(spek.tittel){
    const t = document.createElement('div');
    t.className = 'neam-tabell-tittel';
    t.textContent = spek.tittel;
    ramme.appendChild(t);
  }

  const bokser = [];
  (spek.rader || []).forEach(function(rad){
    const r = document.createElement('label');
    r.className = 'neam-tabell-rad';

    const av = document.createElement('input');
    av.type = 'checkbox';
    av.checked = rad.valgt !== false;
    av.dataset.id = rad.id;
    bokser.push(av);
    r.appendChild(av);

    const tekst = document.createElement('span');
    tekst.className = 'neam-tabell-tekst';
    (rad.celler || []).forEach(function(c, i){
      const d = document.createElement('span');
      d.className = i === 0 ? 'neam-tabell-navn' : 'neam-tabell-verdi';
      d.textContent = c;
      tekst.appendChild(d);
    });
    if(rad.hvorfor){
      const h = document.createElement('span');
      h.className = 'neam-tabell-hvorfor';
      h.textContent = rad.hvorfor;
      tekst.appendChild(h);
    }
    r.appendChild(tekst);
    ramme.appendChild(r);
  });

  const rad = document.createElement('div');
  rad.className = 'neam-tabell-knapper';
  const nei = document.createElement('button');
  nei.type = 'button';
  nei.className = 'neam-tabell-knapp nei';
  nei.textContent = 'Ikke nå';
  const ja = document.createElement('button');
  ja.type = 'button';
  ja.className = 'neam-tabell-knapp ja';
  ja.textContent = 'Gjør det';
  rad.appendChild(nei);
  rad.appendChild(ja);
  ramme.appendChild(rad);

  boks.appendChild(ramme);
  /* Rull etter at den er tegnet: knappene ligger nederst i tabellen, og en
     tabell som slutter under skjermkanten ser ut som en tabell uten
     knapper. Det er da man blir staaende og lure paa hva man skal gjoere. */
  requestAnimationFrame(function(){ boks.scrollTop = boks.scrollHeight; });

  return new Promise(function(ok){
    neamTabellAvbryt();
    neamTabellSvar = ok;
    neamTabellEl = ramme;
    function svar(v){
      if(!neamTabellSvar) return;
      neamTabellSvar = null;
      neamTabellEl = null;
      ramme.remove();
      ok(v);
    }
    nei.onclick = function(){ svar(null); };
    ja.onclick  = function(){
      svar(bokser.filter(function(b){ return b.checked; })
                 .map(function(b){ return b.dataset.id; }));
    };
  });
}

/* Skriving spoer foerst. Lesing gjoer det ikke - et verktoey som bare
   ser etter noe skal ikke kreve en dialog hver gang. */
async function neamGodkjenn(def, blokk){
  if(!def || !def.neamSkriver) return true;
  let tekst = '';
  try{
    if(def.neamBeskriv) tekst = def.neamBeskriv(blokk.input || {}) || '';
  }catch(e){ tekst = ''; }
  if(!tekst) tekst = 'Neam vil kjøre «' + blokk.name + '». Skal den få lov?';
  return await bekreft(tekst, {jaTekst:'Gjør det'});
}

async function neamKjor(blokk, defer){
  const def = defer.find(function(d){ return d.name === blokk.name; });

  if(!def || typeof window.neamUtfor !== 'function'){
    return { type:'tool_result', tool_use_id:blokk.id, is_error:true,
             content:'Verktøyet finnes ikke på denne siden.' };
  }

  /* Vil verktoeyet ha en hel skjerm, er det sida som tegner den - i sine
     egne farger, med sin egen layout, med plass til aa endre paa det Neam
     foreslo. Panelet trekker seg unna mens den staar.

     Panelet vet ikke hvordan sida ser ut, og skal ikke vite det. Derfor
     eier sida skjermen og svarer med et objekt som legges oppaa arg-ene
     foer neamUtfor kalles - noeyaktig som `valgte` fra tabellen. */
  if(def.neamSkjerm){
    const gjemt = document.getElementById('neamBak');
    const varGjemt = gjemt ? gjemt.hidden : true;
    if(gjemt) gjemt.hidden = true;
    let svar = null;
    let sprakk = null;
    try{
      svar = await def.neamSkjerm(blokk.input || {});
    }catch(e){
      sprakk = e;
      console.warn('neamSkjerm(' + blokk.name + ') feilet:', e,
                   '\nargumentene den fikk:', blokk.input);
      svar = null;
    }finally{
      if(gjemt) gjemt.hidden = varGjemt;
      neamTegn();
    }

    /* Kom skjermen tilbake med én gang uten aa vise noe, er det en feil hos
       oss - ikke et valg brukeren tok. Da skal det staa i panelet, ikke
       forsvinne som «brukeren gjorde ingenting». */
    if(sprakk){
      neamPoster.push({ feil:'Skjermen for «' + blokk.name + '» kunne ikke åpnes: '
                           + ((sprakk && sprakk.message) || 'ukjent feil')
                           + '. Se konsollen.' });
      return { type:'tool_result', tool_use_id:blokk.id, is_error:true,
               content:'Skjermen kunne ikke åpnes: ' + ((sprakk && sprakk.message) || 'ukjent feil') };
    }

    if(svar === null || svar === undefined){
      return { type:'tool_result', tool_use_id:blokk.id,
               content:'Brukeren lukket skjermen uten å gjøre noe. Ikke gjenta forslaget - spør om noe annet.' };
    }
    try{
      const arg = Object.assign({}, blokk.input || {}, svar);
      const ut = await window.neamUtfor(blokk.name, arg);
      return { type:'tool_result', tool_use_id:blokk.id,
               content: JSON.stringify(ut === undefined ? null : ut) };
    }catch(e){
      return { type:'tool_result', tool_use_id:blokk.id, is_error:true,
               content: String((e && e.message) || 'Verktøyet feilet.') };
    }
  }

  /* Legger verktoeyet fram flere forslag, tegnes de som en tabell i
     stedet for aa spoerres om ett og ett. De avhukede id-ene foelger med
     som `valgte`. */
  if(def.neamTabell){
    let spek = null;
    try{ spek = def.neamTabell(blokk.input || {}); }catch(e){ spek = null; }
    if(spek && (spek.rader || []).length){
      const valgte = await neamVisTabell(spek);
      if(valgte === null){
        return { type:'tool_result', tool_use_id:blokk.id,
                 content:'Brukeren lot det ligge. Ikke gjenta forslaget - spør om noe annet.' };
      }
      if(!valgte.length){
        return { type:'tool_result', tool_use_id:blokk.id,
                 content:'Brukeren hakte av ingenting. Ingenting ble gjort.' };
      }
      try{
        const arg = Object.assign({}, blokk.input || {}, { valgte: valgte });
        const svar = await window.neamUtfor(blokk.name, arg);
        return { type:'tool_result', tool_use_id:blokk.id,
                 content: JSON.stringify(svar === undefined ? null : svar) };
      }catch(e){
        return { type:'tool_result', tool_use_id:blokk.id, is_error:true,
                 content: String((e && e.message) || 'Verktøyet feilet.') };
      }
    }
  }

  if(!(await neamGodkjenn(def, blokk))){
    /* Avslag er ikke en feil. Neam skal forstaa at brukeren sa nei og
       finne paa noe annet, ikke proeve det samme om igjen. */
    return { type:'tool_result', tool_use_id:blokk.id,
             content:'Brukeren avslo. Ikke prøv dette igjen uten å foreslå noe annet først.' };
  }

  try{
    const svar = await window.neamUtfor(blokk.name, blokk.input || {});
    return { type:'tool_result', tool_use_id:blokk.id,
             content: JSON.stringify(svar === undefined ? null : svar) };
  }catch(e){
    /* Feilen gaar til Neam, ikke til brukeren som en krasj: han kan si
       hva som gikk galt med egne ord, eller proeve en annen vei. */
    console.warn('neamUtfor(' + blokk.name + ') feilet:', e);
    return { type:'tool_result', tool_use_id:blokk.id, is_error:true,
             content: String((e && e.message) || 'Verktøyet feilet.') };
  }
}

/* ============================================================
   Fireren - logikk
   ============================================================ */

/* Appene i huset. Nøklet paa sti, saa knappen for sida man alt
   staar paa kan utelates - en lenke til seg selv er stoey. */
/* Hvor «Til Dash» gaar. Egen konstant fordi den skal bli individuell per
   innlogget bruker - da er det denne verdien som utledes, og ingenting
   annet i fireren trenger aa vite om det. */
const NEAM_DASH = '/dashboard.html';

const NEAM_APPER = [
  /* Forsiden staar i lista fra 30. august 2026. Fireren har tre plasser
     der femmeren hadde fire, og «hjem» var den som taalte flyttingen:
     applista utelater uansett sida du staar paa, saa fra forsiden er den
     usynlig og fra alle andre er den én av veiene ut. */
  { sti:'/',                 navn:'Neam',        ikon:'/bilder/merke-neam.png'        },
  { sti:'/handleliste.html', navn:'Handleliste', ikon:'/bilder/merke-handleliste.png' },
  { sti:'/oppskrifter.html', navn:'Matlaging',   ikon:'/bilder/merke-matlaging.png'   },
  { sti:'/kalender.html',    navn:'Kalender',    ikon:'/bilder/merke-kalender.png'    },
  { sti:'/dashboard.html',   navn:'Kjøkken',     ikon:'/bilder/merke-kjokken-dash.png' }
];

/* Stien til sida, normalisert.

   Cloudflare Pages serverer rene URL-er: /handleliste.html leveres som
   /handleliste. location.pathname er derfor UTEN .html i praksis, mens
   lenkene vaare skriver den. Uten normalisering bommer alle oppslag paa
   sti - baade sidemerket og «utelat sida du staar paa» i applista - og
   de bommer stille, med en reserve som ser plausibel ut.

   Taaler begge former, saa den virker like godt lokalt og bak Pages. */
function neamSti(sti){
  let p = String(sti != null ? sti : location.pathname || '/').toLowerCase();
  p = p.replace(/\.html$/, '');
  p = p.replace(/\/index$/, '/');
  if(p.length > 1) p = p.replace(/\/$/, '');
  return p || '/';
}

/* Sidenes egne merker. Hoeyre haandtak baerer merket til sida du staar
   paa - venstre baerer Neam. Det er hele skillet i ett bilde: venstre er
   «ut og Neam», hoeyre er «her og naa».

   Noeklet paa normalisert sti - se neamSti(). */
const NEAM_SIDEMERKE = {
  '/handleliste': { navn:'Handleliste',  ikon:'/bilder/merke-handleliste.png'  },
  '/oppskrifter': { navn:'Matlaging',    ikon:'/bilder/merke-matlaging.png'    },
  '/kalender'   : { navn:'Kalender',     ikon:'/bilder/merke-kalender.png'     },
  '/dashboard'  : { navn:'Kjøkken dash', ikon:'/bilder/merke-kjokken-dash.png' },
  /* Emma dash staar HER, men ikke i NEAM_APPER. Hoeyre haandtak maa vite
     hvilket merke det skal baere paa sida man staar paa, og uten linja
     under faller Emma dash tilbake paa Neam-merket - «Denne siden» med
     feil bilde. Applista er et annet spoersmaal: den er lik for alle, og
     en knapp dit fra en konto som blir avvist i porten er en snarvei til
     en stengt doer. Skal den inn, maa lista foerst kunne filtreres paa
     innlogget bruker. */
  '/emma'       : { navn:'Emma dash',    ikon:'/bilder/merke-emma-dash.png'    },
  '/'           : { navn:'Neam',         ikon:'/bilder/merke-neam.png'         }
};

function neamSideMerke(){
  return NEAM_SIDEMERKE[neamSti()]
      || { navn:'Denne siden', ikon:NEAM_MERKE };
}

/* ============================================================
   Sidefireren - hoeyre hjoerne
   ------------------------------------------------------------
   Samme grep som venstre, speilvendt, men et annet innhold:
   her ligger handlingene som hoerer til SIDA du staar paa.

   Sidene melder inn sine egne ved aa definere:

     window.neamSideHandlinger = function(){
       return [
         { plass:'opp', navn:'Ny vare', ikon:'<svg…>', gjor:function(){…} },
         { plass:'ved', navn:'Sorter',  ikon:'<svg…>', gjor:sorterMeny }
       ];
     };

   Plassene er 'opp', 'skraa' og 'ved', maalt fra hjoernet haandtaket
   staar i. Haandtaket selv er den fjerde og lukker - det er ikke til
   utdeling.

   En plass ingen har meldt inn SKJULES. Melder sida ingenting inn i
   det hele tatt, skjules haandtaket ogsaa: en meny som aapner seg tom
   er verre enn ingen meny.
   ============================================================ */

const NEAM_SIDEPLASSER = ['opp', 'skraa', 'ved'];

/* Fylles ved bygging og ved hver aapning - en side kan endre hvilke
   handlinger som gjelder mens man staar der. */
let neamSideValg = {};

/* Duselaget. Felles for begge hjoernene - se kommentaren i CSS-en.
   Bygges av neamBygg(). */
/* passivt er id-en paa haandtaket som IKKE er i bruk. Det legges under
   duselaget og dempes med resten av sida - ellers staar det igjen som det
   eneste skarpe punktet paa en flate som nettopp ble tonet ned. */
function neamDuseOpp(passivt){
  const d = document.getElementById('neamDuse');
  if(!d) return;
  ['neamHandtak', 'neamSideHandtak'].forEach(function(id){
    const h = document.getElementById(id);
    if(h) h.classList.toggle('dus', id === passivt);
  });
  d.hidden = false;
  /* Neste ramme, ellers hopper overgangen rett til sluttbildet. */
  requestAnimationFrame(function(){ d.classList.add('oppe'); });
}

function neamDuseNed(){
  const d = document.getElementById('neamDuse');
  if(!d) return;
  d.classList.remove('oppe');
  ['neamHandtak', 'neamSideHandtak'].forEach(function(id){
    const h = document.getElementById(id);
    if(h) h.classList.remove('dus');
  });
  setTimeout(function(){
    /* Rakk det andre hjoernet aa aapne seg i mellomtiden, skal flata bli
       staaende - ellers blinker den bort naar man bytter side. */
    if(!d.classList.contains('oppe')) d.hidden = true;
  }, 190);
}

/* Sant naar sida i det hele tatt har meldt inn noe. Avgjoer om
   haandtaket vises - se kommentaren over. */
function neamSideHarNoe(){
  try{
    if(typeof window.neamSideHandlinger !== 'function') return false;
    return (window.neamSideHandlinger() || []).some(function(v){
      return v && NEAM_SIDEPLASSER.indexOf(v.plass) !== -1;
    });
  }catch(e){ return false; }
}

function neamSideFirer(){
  const f = document.getElementById('neamSideFirer');
  const h = document.getElementById('neamSideHandtak');
  if(!f || !h) return;
  /* Aldri to aapne samtidig: to firere er bredere enn en telefonskjerm
     til sammen, og to menyer oppe er uansett to spoersmaal om gangen. */
  neamFirerNed();
  if(f.classList.contains('oppe')){ neamSideFirerNed(); return; }

  /* Hentes ved hver aapning, ikke bare én gang: hva som er mulig
     avhenger av visningen man staar i. */
  neamSideValg = {};
  try{
    if(typeof window.neamSideHandlinger === 'function'){
      (window.neamSideHandlinger() || []).forEach(function(v){
        if(v && NEAM_SIDEPLASSER.indexOf(v.plass) !== -1) neamSideValg[v.plass] = v;
      });
    }
  }catch(e){ console.warn('neamSideHandlinger feilet:', e); }

  NEAM_SIDEPLASSER.forEach(function(p){
    const k = document.getElementById('neamS_' + p);
    if(!k) return;
    const v = neamSideValg[p];
    k.classList.toggle('doed', !v);
    /* Et merke skal staa uten papirflate under seg - se .neam-knapp.merke. */
    k.classList.toggle('merke', !!(v && v.merke));
    k.innerHTML = (v && v.ikon) || '';
    const navn = v ? v.navn : '';
    k.setAttribute('aria-label', navn);
    k.title = navn;
  });

  neamDuseOpp('neamHandtak');
  /* Haandtaket blir staaende og vokser. */
  h.classList.add('oppe');
  f.hidden = false;
  requestAnimationFrame(function(){ f.classList.add('oppe'); });
  document.addEventListener('pointerdown', neamSideUtenfor, true);
}

function neamSideFirerNed(){
  const f = document.getElementById('neamSideFirer');
  const h = document.getElementById('neamSideHandtak');
  if(!f || !h) return;
  f.classList.remove('oppe');
  h.classList.remove('oppe');
  neamDuseNed();
  const stabel = document.getElementById('neamSideStabel');
  if(stabel) stabel.hidden = true;
  f.classList.remove('gren-opp', 'gren-skraa', 'gren-ved');
  document.removeEventListener('pointerdown', neamSideUtenfor, true);
  setTimeout(function(){ f.hidden = true; }, 190);
}

function neamSideUtenfor(ev){
  /* Haandtaket og undermenyene er soesken av fireren, ikke barn, saa de
     maa telles med - ellers lukker et trykk paa dem menyen i stedet for
     aa gjoere det de er der for. */
  if(neamIStrukturen(ev.target,
      ['neamSideFirer', 'neamSideHandtak', 'neamSideStabel'])) return;
  /* Foerste trykk utenfor er bare en escape - se neamSvelgNesteTrykk. */
  ev.stopPropagation();
  neamSvelgNesteTrykk();
  neamSideFirerNed();
}

/* NEAM_SIDE_TOM sto her til 30. august 2026 - prikken paa en plass ingen
   hadde tatt. Tomme plasser skjules naa, saa den har ingenting aa tegne. */

function neamFirer(){
  const f = document.getElementById('neamFirer');
  const h = document.getElementById('neamHandtak');
  if(!f || !h) return;
  /* Aldri to aapne samtidig - se neamSideFirer(). */
  neamSideFirerNed();
  /* Andre trykk paa haandtaket aapner samtalen. Haandtaket ER Neam, saa
     aa trykke to ganger paa Neam er den korteste veien til ham - og da
     slipper samtalen aa ta en av de tre plassene.

     Lukking skjer ved trykk utenfor, som lukker og svelger trykket saa
     man ikke samtidig treffer noe under. Hoeyre haandtak lukker derimot
     ved andre trykk: der finnes ingen «seg selv» aa aapne. */
  if(f.classList.contains('oppe')){ neamFirerNed(); neamAapne(); return; }
  neamDuseOpp('neamSideHandtak');
  h.classList.add('oppe');
  f.hidden = false;
  /* Neste ramme, saa overgangen faktisk spilles - et element som faar
     klassen i samme ramme som det vises hopper rett til sluttbildet. */
  requestAnimationFrame(function(){ f.classList.add('oppe'); });
  document.addEventListener('pointerdown', neamFirerUtenfor, true);
}

function neamFirerNed(){
  const f = document.getElementById('neamFirer');
  const h = document.getElementById('neamHandtak');
  if(!f || !h) return;
  f.classList.remove('oppe');
  h.classList.remove('oppe');
  neamDuseNed();
  const apper = document.getElementById('neamApper');
  if(apper) apper.hidden = true;
  const enheter = document.getElementById('neamEnheter');
  if(enheter) enheter.hidden = true;
  f.classList.remove('gren-opp', 'gren-skraa', 'gren-ved');
  document.removeEventListener('pointerdown', neamFirerUtenfor, true);
  /* Vent til knappene har trukket seg sammen foer laget gjemmes. */
  setTimeout(function(){ f.hidden = true; }, 190);
}

/* Foerste trykk utenfor er BARE en escape.

   Uten dette gaar det samme trykket videre til det som ligger under:
   man legger ned fireren og aapner samtidig noe man ikke siktet paa,
   eller huker av en vare fordi fireren tilfeldigvis laa over lista.
   Fireren dekker et hjoerne av en side full av trykkflater, saa det
   skjer ofte nok til aa vaere en feil.

   Vi stopper forplantningen, men kaller IKKE preventDefault paa
   pointerdown - det ville stoppet rulling ogsaa, og en side man ikke
   kan bla i mens et hjoerne staar aapent er verre enn problemet.
   Draget faar gaa; det er trykket som svelges, og det gjoeres paa
   klikket etterpaa. */
function neamSvelgNesteTrykk(){
  const typer = ['pointerup', 'mousedown', 'mouseup', 'click', 'touchend'];
  let ferdig = false;

  const slutt = function(){
    if(ferdig) return;
    ferdig = true;
    typer.forEach(function(t){ document.removeEventListener(t, svelg, true); });
  };

  const svelg = function(ev){
    ev.stopPropagation();
    /* Bare paa klikket. preventDefault paa de tidlige hindrer draget. */
    if(ev.type === 'click'){
      if(ev.cancelable) ev.preventDefault();
      slutt();
    }
  };

  typer.forEach(function(t){ document.addEventListener(t, svelg, true); });
  /* Kom det aldri noe klikk - brukeren dro i stedet for aa trykke - skal
     ikke lyttene bli liggende og spise et trykk som kommer senere. */
  setTimeout(slutt, 700);
}

/* Trykk utenfor legger ned - femmeren skal aldri bli staaende og
   dekke et hjoerne av en side man er ferdig med den paa. */
/* Alt som hoerer til laget, ikke bare selve fireren.

   BUGG rettet 30. august 2026: applista laa inne i .neam-firer den gangen
   den var et ark. Da den ble frie knapper, ble den et soesken - og
   utenfor-lytteren regnet dermed hvert trykk paa en app-lenke som et
   trykk UTENFOR. Den svelget klikket og lukket menyen, saa lenkene saa
   helt doede ut. Symptomet var «ingenting skjer», og aarsaken var at det
   skjedde to ting som opphevet hverandre. */
function neamIStrukturen(mal, ider){
  return ider.some(function(id){
    const el = document.getElementById(id);
    return el && el.contains(mal);
  });
}

function neamFirerUtenfor(ev){
  if(neamIStrukturen(ev.target,
      ['neamFirer', 'neamHandtak', 'neamApper', 'neamEnheter'])) return;
  ev.stopPropagation();
  neamSvelgNesteTrykk();
  neamFirerNed();
}

/* Enhetene. Tom liste i dag - Homey er ikke koblet til. Sida kan tilby
   sine egne ved aa sette window.neamEnheter til en liste av
   {navn, ikon, gjor}. Da tar den over, og kolonnen tegner seg selv.

   Er det ingenting aa vise, sies det som det er i stedet for aa aapne en
   tom kolonne - samme regel som for en tom sidefirer. */
/* ============================================================
   Flip-klokka
   ============================================================
   Bygger og driver klapptavla - se .fk i CSS-en for hvordan halvdelene og
   bladene henger sammen. Kalles med elementet klokka skal staa i; foerste
   kall bygger strukturen, senere kall flipper kortene som har endret
   verdi. Sidene kaller den fra sin egen tegnKlokke, i stedet for aa sette
   textContent.

   Flippen er en ren klasse-paa/av: bladene faar sine tall, .flipp settes,
   og naar overgangen er ferdig (560 ms, litt over CSS-ens 540) settes de
   statiske halvdelene til sluttbildet og klassen tas av igjen. Rekker et
   nytt skifte aa komme foer det - det gjoer det aldri med minutter - tas
   bare sluttbildet direkte. */
function neamFlipKlokke(el){
  if(!el) return;
  if(!el.dataset.fk){
    el.dataset.fk = '1';
    el.classList.add('fk');
    el.textContent = '';
    ['t', 'm'].forEach(function(id){
      const k = document.createElement('span');
      k.className = 'fk-kort';
      k.dataset.kort = id;
      k.innerHTML = '<span class="fk-halv fk-o"><b></b></span>'
                  + '<span class="fk-halv fk-n"><b></b></span>'
                  + '<span class="fk-halv fk-blad-o"><b></b></span>'
                  + '<span class="fk-halv fk-blad-n"><b></b></span>';
      el.appendChild(k);
    });
  }
  const n = new Date();
  const vil = { t: String(n.getHours()).padStart(2, '0'),
                m: String(n.getMinutes()).padStart(2, '0') };
  ['t', 'm'].forEach(function(id){
    const kort = el.querySelector('[data-kort="' + id + '"]');
    if(!kort) return;
    const o = kort.querySelector('.fk-o b'),  ned = kort.querySelector('.fk-n b');
    const bo = kort.querySelector('.fk-blad-o b'), bn = kort.querySelector('.fk-blad-n b');
    const ny = vil[id], gml = ned.textContent;
    if(gml === ny) return;
    if(gml === '' || kort.classList.contains('flipp')){
      /* Foerste tegning, eller et skifte midt i et paagaaende flipp:
         rett paa sluttbildet. */
      kort.classList.remove('flipp');
      o.textContent = ned.textContent = ny;
      bo.textContent = bn.textContent = ny;
      return;
    }
    bo.textContent = gml;          /* bladet som faller baerer det gamle */
    bn.textContent = ny;           /* bladet som lander baerer det nye */
    o.textContent = ny;            /* avdekkes bak det fallende bladet */
    kort.classList.add('flipp');
    setTimeout(function(){
      ned.textContent = ny;
      bo.textContent = ny;
      kort.classList.remove('flipp');
    }, 560);
  });
}

/* ============================================================
   Roerdelene
   ============================================================
   Tegner roeret som binder en rad knapper til moderknappen sin: stigning
   opp fra moderknappen, bend, bro bortover over knappene, T-stykke ned i
   hver mellomliggende knapp og bend ned i den ytterste.

   Delene er bilder med fast stoerrelse (se .rdel i CSS-en), og maaltallene
   der er hvor armsentrene ligger i hver del. Alt posisjoneres med calc()
   paa de samme CSS-variablene som knappene bruker, saa geometrien flytter
   seg med naar --f-aapen og --f-luft endres.

   `side` speiler: i hoeyre hjoerne staar moderknappen til HOEYRE for
   raden, i venstre til VENSTRE. `antall` er knappene i NEDERSTE rad -
   wrappede knapper henger i raden under med sitt eget pseudo-roer.

   Returnerer HTML-strengen; kalleren legger den FOERST i boksen, saa
   knappene tegnes over roerene. */
function neamRorRad(antall, side){
  const A = 'var(--f-aapen)', L = 'var(--f-luft)', T = 'var(--ror-tykk)';
  const ytre = side ? 'right' : 'left';       /* mot moderknappen */
  const indre = side ? 'left' : 'right';
  /* Brosenteret over radbunnen, og moderknappens senter utenfor boksen. */
  const broB = 'calc(' + A + '/2 + var(--bro))';
  const mor  = 'calc(-1*(' + L + ' + ' + A + '/2))';
  const d = [];
  function del(kl, stil){ d.push('<i class="rdel ' + kl + '" style="' + stil + '"></i>'); }

  /* Stigningen: fra moderknappens senter opp mot bendet. */
  del('flis-v', ytre + ':calc(' + mor + ' - ' + T + '/2);'
    + 'bottom:calc(' + A + '/2); height:calc(var(--bro) - 18px);');
  /* Bendet over moderknappen. Sidearm-senter 9 fra topp -> bunnen staar
     23 under brosenteret; nedarm-senter 21.5 (nv) / 9 (nh) fra venstre. */
  del('hel ' + (side ? 'bend-nv' : 'bend-nh'),
      ytre + ':calc(' + mor + ' - ' + (side ? '9.5px' : '9px') + ');'
    + 'bottom:calc(' + broB + ' - 23px);');
  /* Broen: fra ytterste knapps senter til moderknappens senter. Endene
     ligger under bendene. */
  del('flis-h', indre + ':calc(' + A + '/2);'
    + ytre + ':' + mor + ';'
    + 'bottom:calc(' + broB + ' - ' + T + '/2);');
  /* Bendet ned i den YTTERSTE knappen (lengst fra moderknappen). */
  del('hel ' + (side ? 'bend-nh' : 'bend-nv'),
      indre + ':calc(' + A + '/2 - ' + (side ? '9px' : '9.5px') + ');'
    + 'bottom:calc(' + broB + ' - 23px);');
  /* Per knapp: nedstikk fra broen ned i knappen; T-stykke over broen for
     alle unntatt den ytterste (der bendet er skjoeten). */
  for(let i = 0; i < antall; i++){
    const senter = 'calc(' + A + '/2 + ' + i + '*(' + A + ' + ' + L + '))';
    del('flis-v', ytre + ':calc(' + senter + ' - ' + T + '/2);'
      + 'bottom:calc(' + A + '/2); height:var(--bro);');
    if(i < antall - 1){
      del('hel t-ned', ytre + ':calc(' + senter + ' - 22px);'
        + 'bottom:calc(' + broB + ' - 20px);');
    }
  }
  return d.join('');
}

/* Aapner en kolonne over en av plassene i sidefireren. Brukes av en
   sidehandling som ikke gjoer noe selv, men som rommer flere:

     { plass:'ved', navn:'System', ikon:'…', gjor:function(){
         neamSideStabel('ved', [
           { navn:'Oppdater', ikon:'<svg…>', gjor:function(){ location.reload(); } },
           { navn:'Logg ut',  ikon:'<svg…>', gjor:loggUt }
         ]);
       } }

   Fireren blir staaende mens stabelen er oppe - den er et lag til, ikke
   en ny skjerm. */
function neamSideStabel(plass, liste){
  const boks = document.getElementById('neamSideStabel');
  if(!boks) return;
  if(!boks.hidden){ boks.hidden = true; neamSideGren(''); return; }
  if(!liste || !liste.length) return;

  /* «opp» staar i oeverste rad og har tak over seg - da vokser valgene
     oppover. «ved» staar i nederste rad ved siden av haandtaket, og der er
     veien videre innover, ikke opp: en kolonne derfra ville lagt seg bak
     «opp» og «skraa». */
  boks.className = 'neam-stabel side '
                 + (plass === 'opp' ? 'fra-opp' : 'fra-ved rad');
  boks.innerHTML = liste.map(function(v, i){
    return '<button type="button" class="neam-enhet' + (v.merke ? ' merke' : '') + '" '
         +   'data-nr="' + i + '" title="' + v.navn + '" aria-label="' + v.navn + '">'
         +   (v.ikon || '') + '</button>';
  }).join('');
  Array.prototype.forEach.call(boks.querySelectorAll('.neam-enhet'), function(k){
    k.onclick = function(){
      const v = liste[parseInt(k.dataset.nr, 10)];
      boks.hidden = true;
      neamSideFirerNed();
      if(v && typeof v.gjor === 'function'){
        try{ v.gjor(); }catch(e){ console.warn('Systemvalg feilet:', e); }
      }
    };
  });
  boks.hidden = false;
  neamSideGren(plass);

  /* Hvem som havnet paa en rad over kan bare avgjoeres etter at raden er
     tegnet - det avhenger av skjermbredden. Nederste rad er den med
     stoerst offsetTop; alt annet henger over den og faar roeret sitt
     pekende nedover i stedet for opp mot broen. */
  const knapper = Array.prototype.slice.call(boks.querySelectorAll('.neam-enhet'));
  if(knapper.length){
    const nederst = Math.max.apply(null, knapper.map(function(k){ return k.offsetTop; }));
    let iNederst = 0;
    knapper.forEach(function(k){
      const over = k.offsetTop < nederst;
      k.classList.toggle('over', over);
      if(!over) iNederst++;
    });
    /* Roerdelene tegnes naa som soesken FOER knappene, for raden vi
       faktisk fikk. Broen gjelder bare nederste rad. */
    if(plass === 'ved'){
      boks.insertAdjacentHTML('afterbegin', neamRorRad(iNederst, true));
    }
  }
}

/* Merker hvilken gren som er valgt, saa roerene til de andre kan falle
   bort. Tom streng betyr ingen - da staar alle tre aapne. */
function neamGrenPaa(id, plass){
  const f = document.getElementById(id);
  if(!f) return;
  f.classList.remove('gren-opp', 'gren-skraa', 'gren-ved');
  if(plass) f.classList.add('gren-' + plass);
}
function neamGren(plass){     neamGrenPaa('neamFirer', plass); }
function neamSideGren(plass){ neamGrenPaa('neamSideFirer', plass); }

function neamVisEnheter(){
  const boks = document.getElementById('neamEnheter');
  if(!boks) return;
  if(!boks.hidden){ boks.hidden = true; neamGren(''); return; }

  let liste = [];
  try{
    if(typeof window.neamEnheter === 'function') liste = window.neamEnheter() || [];
    else if(Array.isArray(window.neamEnheter))   liste = window.neamEnheter;
  }catch(e){ liste = []; }

  if(!liste.length){
    if(typeof varsle === 'function'){
      varsle('Lysstyring kommer - Homey er ikke koblet til ennå.');
    }
    return;
  }

  boks.innerHTML = liste.map(function(e, i){
    return '<button type="button" class="neam-enhet" data-nr="' + i + '" '
         +   'title="' + e.navn + '" aria-label="' + e.navn + '">'
         +   (e.ikon || '') + '</button>';
  }).join('');
  Array.prototype.forEach.call(boks.querySelectorAll('.neam-enhet'), function(k){
    k.onclick = function(){
      const e = liste[parseInt(k.dataset.nr, 10)];
      if(e && typeof e.gjor === 'function'){
        try{ e.gjor(); }catch(err){ console.warn('Enhet feilet:', err); }
      }
    };
  });
  boks.hidden = false;
  neamGren('opp');
}

function neamVisApper(){
  const boks = document.getElementById('neamApper');
  if(!boks) return;
  if(!boks.hidden){ boks.hidden = true; neamGren(''); return; }
  const her = neamSti();
  /* Én knapp per app, i samme stoerrelse som knappene i fireren. Navnet
     staar i aria-label og ikke som tekst under: merkene baerer navnet
     sitt selv, og skjermlesere trenger det likevel. */
  const apper = NEAM_APPER.filter(function(a){ return neamSti(a.sti) !== her; });
  boks.innerHTML = apper.map(function(a){
      return '<a class="neam-app-lenke" href="' + a.sti + '" '
           +   'title="' + a.navn + '" aria-label="' + a.navn + '">'
           +   '<img src="' + a.ikon + '" alt="">'
           + '</a>';
    }).join('');

  /* Roeret under raden: samlerroer med endekrager, oppstikk med T-stykke
     opp i hvert merke, og stammen med T ned mot «skraa». Alt er deler fra
     arket - se .rdel i CSS-en. Legges foerst, saa merkene tegnes over. */
  (function(){
    const A = 'var(--f-aapen)', L = 'var(--f-luft)', T = 'var(--ror-tykk)';
    const rorB = 'calc(-1*var(--app-ror) - ' + T + '/2)';     /* roerets bunn */
    const n = apper.length;
    if(!n) return;
    const d = [];
    function del(kl, stil){ d.push('<i class="rdel ' + kl + '" style="' + stil + '"></i>'); }
    /* Samlerroeret fra foerste til siste merkesenter. */
    del('flis-h', 'left:calc(' + A + '/2); right:calc(' + A + '/2);'
      + 'bottom:' + rorB + ';');
    for(let i = 0; i < n; i++){
      const senter = 'calc(' + A + '/2 + ' + i + '*(' + A + ' + ' + L + '))';
      /* Oppstikk fra roeret opp i merket. */
      del('flis-v', 'left:calc(' + senter + ' - ' + T + '/2);'
        + 'bottom:' + rorB + '; height:calc(' + A + '/2 + var(--app-ror));');
      /* T med stammen opp - gjennomroer-senter 16 fra topp, stamme 23. */
      if(i > 0 && i < n - 1){
        del('hel t-opp', 'left:calc(' + senter + ' - 23px);'
          + 'bottom:calc(' + rorB + ' + ' + T + '/2 - 9px);');
      }
    }
    /* Endekrager paa samlerroeret. */
    del('hel krage-h', 'left:calc(' + A + '/2 - 6.5px);'
      + 'bottom:calc(' + rorB + ' - 4.5px);');
    del('hel krage-h', 'right:calc(' + A + '/2 - 6.5px);'
      + 'bottom:calc(' + rorB + ' - 4.5px);');
    /* Stammen ned til «skraa»-knappens senter, med T i avgreiningen. */
    const skraaX = 'calc(1.5*' + A + ' + ' + L + ')';
    del('flis-v', 'left:calc(' + skraaX + ' - ' + T + '/2);'
      + 'bottom:calc(-1*(' + A + '/2 + 16px));'
      + 'height:calc(' + A + '/2 + 16px - var(--app-ror));');
    del('hel t-ned', 'left:calc(' + skraaX + ' - 22px);'
      + 'bottom:calc(' + rorB + ' + ' + T + '/2 - 20px);');
    boks.insertAdjacentHTML('afterbegin', d.join(''));
  })();
  boks.hidden = false;
  neamGren('skraa');
}

/* ============================================================
   Panelet
   ============================================================ */

function neamBygg(){
  if(neamBygd) return;
  neamBygd = true;

  const handtak = document.createElement('button');
  handtak.type = 'button';
  handtak.className = 'neam-handtak';
  handtak.id = 'neamHandtak';
  handtak.title = 'Neam';
  handtak.setAttribute('aria-label', 'Snakk med Neam');
  handtak.innerHTML = '<img src="' + NEAM_MERKE + '" alt="">';
  handtak.onclick = neamFirer;
  document.body.appendChild(handtak);

  /* ============================================================
     Fireren
     ------------------------------------------------------------
     Ett trykk paa merket loefter det til dobbel stoerrelse og
     aapner tre knapper rundt - fire prikker paa en terning, der
     haandtaket selv er den fjerde. Retningene betyr det samme paa
     alle sidene:

        opp     enheter og lys
        skraa   de andre appene
        ved     tilbake til Dash

     Enheter og Dash byttet plass 30. august 2026. Grunnen er utleggingen:
     enhetene legger seg VERTIKALT opp fra knappen sin, appene vannrett
     fra sin, og en kolonne trenger en knapp med tak over seg. «opp» er
     den eneste som har det.

     Samtalen ligger paa haandtaket selv, paa andre trykk - se
     neamFirer(). Det var en femmer til 30. august 2026, der midten
     aapnet samtalen og en femte knapp la den ned; naar haandtaket blir
     staaende, gjoer det begge jobbene, og plassene gaar til noe som
     faktisk gjoer noe. «Hjem» flyttet samtidig inn i applista, se
     NEAM_APPER. */
  /* Foerst i DOM-en av knappelaget, saa den ligger under alt den demper. */
  const duse = document.createElement('div');
  duse.className = 'neam-duse';
  duse.id = 'neamDuse';
  duse.hidden = true;
  document.body.appendChild(duse);

  const firer = document.createElement('div');
  firer.className = 'neam-firer';
  firer.id = 'neamFirer';
  firer.hidden = true;

  const knapp = function(id, plass, tekst, ikon){
    return '<button type="button" class="neam-knapp ' + plass + '" id="' + id + '"'
         + ' aria-label="' + tekst + '" title="' + tekst + '">' + ikon + '</button>';
  };
  firer.innerHTML =
      knapp('neamTLys', 'opp', 'Enheter og lys',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
      + 'stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.9.7 1.5 1.7 1.5 2.8V17h4v-.3c0-1.1.6-2.1 1.5-2.8A6 6 0 0 0 12 3z"/></svg>')
    + knapp('neamTApper', 'skraa', 'Andre apper',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
      + 'stroke-linecap="round"><rect x="4" y="4" width="6" height="6" rx="1.5"/>'
      + '<rect x="14" y="4" width="6" height="6" rx="1.5"/>'
      + '<rect x="4" y="14" width="6" height="6" rx="1.5"/>'
      + '<rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>')
    + knapp('neamTDash', 'ved', 'Til Dash',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
      + 'stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="3" y="4" width="18" height="14" rx="2"/>'
      + '<path d="M3 9h18M9 18v3M15 18v3M8 21h8"/></svg>');
  document.body.appendChild(firer);

  /* Applista er sin egen boks utenfor fireren: den er fastposisjonert mot
     skjermen, og laa den inni, ville den fulgt fireren naar den skjules. */
  const apperBoks = document.createElement('div');
  apperBoks.className = 'neam-apper';
  apperBoks.id = 'neamApper';
  apperBoks.hidden = true;
  document.body.appendChild(apperBoks);

  const enhetBoks = document.createElement('div');
  enhetBoks.className = 'neam-stabel fra-opp';
  enhetBoks.id = 'neamEnheter';
  enhetBoks.hidden = true;
  document.body.appendChild(enhetBoks);

  /* ---- Hoeyre hjoerne: sidas egne handlinger ----
     Speilvendt av venstre. Merket er sidas eget, saa hvilken app du
     staar i kan leses av hjoernet uten at noe staar skrevet.

     Melder sida ingenting inn, staar haandtaket ikke der i det hele
     tatt - en meny som aapner seg tom er verre enn ingen meny. */
  const sm = neamSideMerke();

  const sHandtak = document.createElement('button');
  sHandtak.type = 'button';
  sHandtak.className = 'neam-handtak side';
  sHandtak.id = 'neamSideHandtak';
  sHandtak.title = sm.navn;
  sHandtak.setAttribute('aria-label', sm.navn + ' - handlinger');
  sHandtak.innerHTML = '<img src="' + sm.ikon + '" alt="">';
  sHandtak.onclick = neamSideFirer;
  sHandtak.hidden = !neamSideHarNoe();
  document.body.appendChild(sHandtak);

  /* Sidas egen stabel. Hvilken plass den henger under settes naar den
     aapnes - se neamSideStabel(). */
  const sStabel = document.createElement('div');
  sStabel.className = 'neam-stabel side fra-ved';
  sStabel.id = 'neamSideStabel';
  sStabel.hidden = true;
  document.body.appendChild(sStabel);

  const sFirer = document.createElement('div');
  sFirer.className = 'neam-firer side';
  sFirer.id = 'neamSideFirer';
  sFirer.hidden = true;
  sFirer.innerHTML =
      NEAM_SIDEPLASSER.map(function(p){
        return '<button type="button" class="neam-knapp doed ' + p + '" '
             + 'id="neamS_' + p + '"></button>';
      }).join('');
  document.body.appendChild(sFirer);

  NEAM_SIDEPLASSER.forEach(function(p){
    document.getElementById('neamS_' + p).onclick = function(){
      const v = neamSideValg[p];
      if(!v) return;                 /* skjult uansett - se .neam-knapp.doed */
      /* En handling som ROMMER flere - System, for eksempel - skal la
         fireren staa: den aapner et lag til, den forlater ikke menyen.
         Uten dette lukket menyen seg i samme oeyeblikk som undervalgene
         kom fram, og de sto igjen alene paa en tom skjerm. */
      if(!v.behold) neamSideFirerNed();
      try{ v.gjor(); }catch(e){ console.warn('Sidehandling feilet:', e); }
    };
  });

  const bak = document.createElement('div');
  bak.className = 'neam-bak';
  bak.id = 'neamBak';
  bak.hidden = true;
  bak.innerHTML =
      '<div class="neam-panel" role="dialog" aria-modal="true" aria-label="Neam">'
    +   '<div class="neam-topp">'
    +     '<span class="neam-topp-merke"><img src="' + NEAM_MERKE + '" alt=""></span>'
    +     '<span class="neam-topp-tekst">'
    +       '<span class="neam-navn">Neam</span>'
    +       '<span class="neam-sted" id="neamSted"></span>'
    +     '</span>'
    +     '<button type="button" class="neam-topp-knapp modell" id="neamModell" '
    +       'title="Bytt modell"></button>'
    +     '<button type="button" class="neam-topp-knapp" id="neamNy">'
    +       '<span class="lang">Ny samtale</span><span class="kort">Ny</span></button>'
    +     '<button type="button" class="neam-lukk" id="neamLukk" aria-label="Lukk">&times;</button>'
    +   '</div>'
    +   '<div class="neam-samtale" id="neamSamtale"></div>'
    +   '<div class="neam-bunn">'
    +     '<textarea class="neam-felt" id="neamFelt" rows="1" '
    +       'placeholder="Spør Neam om noe"></textarea>'
    +     '<button type="button" class="neam-send" id="neamSend" aria-label="Send">'
    +       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
    +         'stroke-linecap="round" stroke-linejoin="round">'
    +         '<path d="M4 12h15M13 6l6 6-6 6"/></svg>'
    +     '</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(bak);

  document.getElementById('neamLukk').onclick = neamLukk;
  document.getElementById('neamSend').onclick = neamSend;
  document.getElementById('neamNy').onclick   = neamNySamtale;
  document.getElementById('neamTDash').onclick = function(){
    neamFirerNed();
    /* Fast side inntil videre. Dash skal etter hvert vaere den enkelte
       brukerens egen - da byttes stien her, ikke knappen. */
    location.href = NEAM_DASH;
  };
  document.getElementById('neamTApper').onclick = neamVisApper;
  document.getElementById('neamTLys').onclick = neamVisEnheter;
  document.getElementById('neamModell').onclick = function(){
    /* Ikke midt i en tur: modellen som svarer skal vaere den som ble
       spurt. Byttet gjelder fra neste melding. */
    if(neamVenter) return;
    /* Har en oppgave laast modellen, loefter foerste trykk laasen i stedet
       for aa hoppe videre - ellers maatte man gjennom hele runden for aa
       komme tilbake til den man alt saa paa. */
    if(neamPaatvunget){ neamPaatvunget = null; }
    else neamNesteModell();
    neamTegnModell();
  };
  neamTegnModell();

  /* Klikk paa bakgrunnen lukker, slik modalene ellers gjoer. */
  bak.onclick = function(ev){ if(ev.target === bak) neamLukk(); };

  document.addEventListener('keydown', function(ev){
    if(ev.key === 'Escape' && !bak.hidden) neamLukk();
  });

  const felt = document.getElementById('neamFelt');
  felt.addEventListener('input', neamVoks);
  felt.addEventListener('keydown', function(ev){
    /* Enter sender, skift+enter gir linjeskift. */
    if(ev.key === 'Enter' && !ev.shiftKey){ ev.preventDefault(); neamSend(); }
  });

  neamPoster = neamHent();
  /* En samtale som ble avbrutt midt i en runde ligger her med et hull i.
     Den lappes foer den vises, ikke naar den feiler. */
  neamReparer();
  neamTegn();
}

async function neamAapne(){
  neamBygg();
  document.getElementById('neamBak').hidden = false;
  neamTegn();

  /* Fokus bare paa bred skjerm. Paa mobil ville tastaturet lagt seg
     over halve panelet foer du har sett hva som staar der. */
  if(window.innerWidth > 520){
    const felt = document.getElementById('neamFelt');
    if(felt) felt.focus();
  }

  /* Stedet hentes hver gang panelet aapnes - visningen kan ha byttet
     siden sist. */
  neamSkrivSted(await neamSted());
}

function neamTegnModell(){
  const k = document.getElementById('neamModell');
  if(!k) return;
  k.textContent = neamModell().navn;
  k.classList.toggle('fast', !!neamPaatvunget);
  k.title = neamPaatvunget
    ? 'Oppgaven ba om denne modellen. Trykk for å velge selv.'
    : 'Bytt modell';
}

function neamSkrivSted(k){
  const ut = document.getElementById('neamSted');
  if(ut) ut.textContent = neamStedTekst(k);
}

function neamLukk(){
  /* Staar det en tabell og venter, teller lukking som «ikke naa» - ellers
     blir verktoeykallet haengende og panelet staar laast neste gang. */
  neamTabellAvbryt();
  const bak = document.getElementById('neamBak');
  if(bak) bak.hidden = true;
}

async function neamNySamtale(){
  if(neamPoster.length &&
     !(await bekreft('Starte på nytt? Det som står her forsvinner.',
                     {jaTekst:'Start på nytt'}))) return;
  /* Staar det en tabell og venter, hoerer den til samtalen som naa er
     borte. Uten dette ble den haengende igjen paa skjermen mens loekka
     ventet paa et svar ingen lenger kunne gi - og «Neam tenker …» sto
     til sida ble lastet paa nytt. */
  neamTabellAvbryt();
  neamPoster = [];
  neamPaatvunget = null;      /* oppgaven er over */
  neamLagre();
  neamTegnModell();
  neamTegn();
}

function neamVoks(){
  const felt = document.getElementById('neamFelt');
  if(!felt) return;
  felt.style.height = 'auto';
  felt.style.height = Math.min(felt.scrollHeight, 120) + 'px';
}

/* ============================================================
   Tegning
   ------------------------------------------------------------
   Alt tegnes ut fra de lagrede API-meldingene. Da finnes det bare
   én sannhet om hva som har skjedd, og en samtale som hentes fram
   igjen etter en sideveksling ser lik ut som foer.
   ============================================================ */

function neamBoble(boks, klasse, tekst){
  const el = document.createElement('div');
  el.className = 'neam-melding ' + klasse;
  el.textContent = tekst;
  boks.appendChild(el);
}

function neamTegn(){
  const boks = document.getElementById('neamSamtale');
  if(!boks) return;
  boks.innerHTML = '';

  if(!neamPoster.length && !neamVenter){
    const tom = document.createElement('p');
    tom.className = 'neam-tom';
    tom.textContent = 'Neam vet hvilken side du står på, og kan lese det som ligger her. '
                    + 'Spør om noe.';
    boks.appendChild(tom);
    return;
  }

  neamPoster.forEach(function(p){
    if(p.feil){ neamBoble(boks, 'feil', p.feil); return; }
    const m = p.api;
    if(!m) return;

    if(typeof m.content === 'string'){
      /* Beskjeden sida ga Neam vises ikke. Den maa ligge i historikken -
         API-et kjenner ingen annen maate aa gi en instruks paa - men den
         er skrevet for ham, ikke for brukeren, og en instruks man leser
         over skulderen gjoer bare samtalen lengre. */
      if(p.auto) return;
      neamBoble(boks, m.role === 'user' ? 'meg' : 'bot', m.content);
      return;
    }

    (m.content || []).forEach(function(b){
      if(b.type === 'text' && String(b.text || '').trim()){
        neamBoble(boks, 'bot', b.text);
      }else if(b.type === 'server_tool_use'){
        /* Nettsoeket vises som en linje, som vaare egne verktoey - men med
           soekeordet, siden det er det eneste som sier hva han lette etter. */
        const el = document.createElement('div');
        el.className = 'neam-verktoy nett';
        const q = (b.input && b.input.query) ? String(b.input.query) : '';
        el.textContent = q ? ('søk på nettet: ' + q) : 'søk på nettet';
        boks.appendChild(el);
      }else if(b.type === 'tool_use'){
        /* Verktoeykallet vises som en linje, ikke som en boble: det er
           noe som skjedde, ikke noe som ble sagt. Resultatet vises ikke -
           det er Neams arbeidsmateriale, og han gjenforteller det som
           betyr noe i svaret sitt. */
        const el = document.createElement('div');
        el.className = 'neam-verktoy';
        el.textContent = String(b.name || '').replace(/_/g, ' ');
        boks.appendChild(el);
      }
    });
  });

  /* Ikke «tenker» mens en tabell venter paa svar. Loekka staar riktignok
     og venter - men den venter paa BRUKEREN, ikke paa modellen, og en
     tekst som sier at Neam jobber faar folk til aa vente i stedet for aa
     trykke. Det var akkurat det som skjedde. */
  if(neamVenter && !neamTabellEl) neamBoble(boks, 'bot tenker', 'Neam tenker …');

  /* Tabellen er ikke en melding og ligger derfor ikke i neamPoster - men
     den henger i den samme boksen, som toemmes her. Blir den tegnet bort
     mens den venter paa svar, blir loefta staaende for alltid og panelet
     laast. Den settes derfor tilbake etter hver tegning. */
  if(neamTabellEl) boks.appendChild(neamTabellEl);

  boks.scrollTop = boks.scrollHeight;
}

/* ============================================================
   Sending
   ============================================================ */

async function neamSend(){
  if(neamVenter) return;

  const felt = document.getElementById('neamFelt');
  const tekst = felt ? felt.value.trim() : '';
  if(!tekst) return;

  felt.value = '';
  neamVoks();

  neamPoster.push({ api:{ role:'user', content:tekst } });
  await neamTur();
}

/* Én runde: send det som staar, kjoer verktoeyene Neam ber om, gjenta til
   han er ferdig. Delt mellom det brukeren skriver og det sida ber om
   gjennom neamStart(). */
async function neamTur(){
  neamReparer();
  neamVenter = true;
  const knapp = document.getElementById('neamSend');
  if(knapp) knapp.disabled = true;
  neamLagre();
  neamTegn();

  try{
    /* Kontekst og verktoey hentes paa nytt for hver melding, ikke én
       gang ved aapning: panelet staar oppe mens du kan ha byttet
       visning bak det. De ligger utenfor historikken, saa den holder
       seg ren. */
    const k = await neamSted();
    neamSkrivSted(k);
    const defer  = await neamVerktoyliste();
    const system = neamSystem(k, defer.length > 0, await neamBakgrunn());

    let runde = 0;
    while(true){
      const svar = await neamKall(neamHistorikk(), system, defer);
      neamPoster.push({ api:{ role:'assistant', content:svar.content || [] } });
      neamLagre();
      neamTegn();

      if(svar.stop_reason !== 'tool_use'){
        /* En melding uten tekst tegner ingenting, og da ser panelet ut som
           om det ga opp i stillhet. Det skjer naar svaret blir kuttet av
           paa max_tokens midt i et verktoeykall: stop_reason er ikke
           'tool_use', saa loekka avsluttes, men det finnes ingen tekst aa
           vise. Da sier vi det i stedet for aa la brukeren staa og se paa
           en tom skjerm. */
        /* Ble svaret kuttet paa max_tokens, skal det ALLTID sies - ogsaa naar
           det rakk aa skrive litt tekst foerst. Foer sjekket vi bare om det
           fantes tekst, og et svar som besto av en setning pluss et halvt
           verktoeykall gikk derfor stille ut: setningen ble vist, kallet
           forsvant, og panelet saa ut som om det ga opp. */
        if(svar.stop_reason === 'max_tokens'){
          try{
            console.warn('Neam ble kuttet av.', '\nut-tokens:',
              svar.usage && svar.usage.output_tokens, '\nblokker:',
              (svar.content || []).map(function(b){
                const lengde = b.type === 'text' ? String(b.text || '').length
                             : JSON.stringify(b.input || b).length;
                return b.type + (b.name ? '/' + b.name : '') + ' (' + lengde + ' tegn)';
              }).join(', '), '\nhele svaret:', svar);
          }catch(e){}
          neamPoster.push({ feil:'Neam ble avbrutt midt i - svaret ble for langt. '
                              + 'Be om mindre av gangen, eller prøv på nytt.' });
          break;
        }

        const harTekst = (svar.content || []).some(function(b){
          return b.type === 'text' && String(b.text || '').trim();
        });
        if(!harTekst){
          /* Legg fram hva han faktisk holdt paa med da det tok slutt.
             Uten dette er en avkutting bare «for langt», og da gjetter man
             paa aarsaken i stedet for aa lese den. */
          try{
            console.warn('Neam ble kuttet av. stop_reason=' + svar.stop_reason,
              '\nut-tokens:', svar.usage && svar.usage.output_tokens,
              '\ninn-tokens:', svar.usage && svar.usage.input_tokens,
              '\nblokker:', (svar.content || []).map(function(b){
                const lengde = b.type === 'text' ? String(b.text || '').length
                             : JSON.stringify(b.input || b).length;
                return b.type + (b.name ? '/' + b.name : '') + ' (' + lengde + ' tegn)';
              }).join(', '),
              '\nhele svaret:', svar);
          }catch(e){}

          const sistTekst = (svar.content || []).filter(function(b){ return b.type === 'text'; }).pop();
          neamPoster.push({ feil: svar.stop_reason === 'max_tokens'
            ? 'Neam skrev for mye på én gang og ble kuttet av. Se konsollen for hva han holdt på med.'
              + (sistTekst ? '\n\nSå langt kom han:\n' + String(sistTekst.text).slice(0, 400) : '')
            : 'Neam svarte uten tekst (' + (svar.stop_reason || 'ukjent grunn') + ').' });
        }
        break;
      }

      if(++runde > NEAM_MAKS_RUNDER){
        /* neamReparer() fyller inn svarene som mangler foer neste tur, saa
           samtalen kan fortsette selv om denne runden ble stoppet. */
        neamPoster.push({ feil:'Neam holdt på for lenge med samme oppgave, så jeg stoppet det. '
                             + 'Prøv å be om én ting av gangen.' });
        break;
      }

      const kall = (svar.content || []).filter(function(b){ return b.type === 'tool_use'; });

      /* Ber Neam om tjue oppslag i én melding, tok det tjue ganger saa lang
         tid som ett - de gikk etter hverandre, enda de bare leser fra minnet
         og ikke venter paa noe.

         Lesing gaar derfor samtidig. Skriving gjoer det ikke: hver skriving
         har sin egen bekreftelse, og to dialoger oppaa hverandre er ingen
         dialog. De kjoeres etter hverandre, i den rekkefoelgen Neam ba om
         dem, saa brukeren ser én ting av gangen. */
      const resultater = new Array(kall.length);
      const skriver = kall.map(function(b){
        const d = defer.find(function(x){ return x.name === b.name; });
        return !!(d && d.neamSkriver);
      });

      await Promise.all(kall.map(function(b, i){
        if(skriver[i]) return null;
        return neamKjor(b, defer).then(function(r){ resultater[i] = r; });
      }));

      for(let i = 0; i < kall.length; i++){
        if(skriver[i]) resultater[i] = await neamKjor(kall[i], defer);
      }

      neamPoster.push({ api:{ role:'user', content:resultater } });
      neamLagre();
      neamTegn();
    }
  }catch(e){
    console.warn('Neam:', e);
    neamPoster.push({ feil: (e && e.message) || 'Noe gikk galt.' });
  }finally{
    /* I finally, ikke etter loekka: ryker noe uventet, skal panelet
       fortsatt kunne brukes. */
    neamVenter = false;
    /* Begrensningen gjaldt denne turen. Skriver brukeren selv etterpaa, skal
       han ha alt igjen. */
    neamTurVerktoy = null;
    const send = document.getElementById('neamSend');
    if(send) send.disabled = false;
    neamLagre();
    neamTegn();
  }
}

/* ============================================================
   Naar sida tar kontakt
   ------------------------------------------------------------
   Sida kan starte en samtale selv:

     await neamStart('Varene er lagt over. Gaa gjennom lista og ...');

   Beskjeden lagres som en brukertur - API-et kjenner ingen annen
   maate aa gi en instruks paa - men den TEGNES som en linje, ikke
   som en boble. Brukeren skal se hva Neam ble bedt om, uten at det
   ser ut som noe han skrev selv.

   `friskt` tommer samtalen foerst. Bruk det naar sida starter noe
   nytt: en gjennomgang som arver et halvferdig resonnement fra en
   time siden begynner paa feil sted.

   Staar Neam alt og jobber, gjoer kallet ingenting. Én ting av
   gangen i ett panel.
   ============================================================ */
async function neamStart(beskjed, valg){
  const v = valg || {};
  if(neamVenter) return;
  const tekst = String(beskjed || '').trim();
  if(!tekst) return;

  neamBygg();
  if(v.friskt){ neamPoster = []; neamPaatvunget = null; }
  /* Oppgaven kan si hva den trenger: neamStart(..., {modell:'sonnet'}).
     Ukjent navn ignoreres - da gaar det som foer, i stedet for at en
     skrivefeil stopper en gjennomgang. */
  if(v.modell){
    const id = neamModellId(v.modell);
    if(id) neamPaatvunget = id;
  }
  neamTegnModell();
  document.getElementById('neamBak').hidden = false;
  neamSkrivSted(await neamSted());

  neamTurVerktoy = Array.isArray(v.verktoy) && v.verktoy.length ? v.verktoy : null;

  neamPoster.push({ api:{ role:'user', content:tekst }, auto:true });
  await neamTur();
}

/* ============================================================
   Oppstart
   ============================================================ */

if(document.body) neamBygg();
else document.addEventListener('DOMContentLoaded', neamBygg);
