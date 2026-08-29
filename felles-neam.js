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
  handtak.onclick = neamAapne;
  document.body.appendChild(handtak);

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
