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

   neamVerktoy() - lista over hva som kan gjoeres PAA DENNE SIDA.
   Vanlige verktoeydefinisjoner (name, description, input_schema)
   pluss to felter som er vaare egne og strippes foer sending:

     neamSkriver  true naar verktoeyet endrer noe. Da spoer
                  panelet foerst, og gjoer ingenting uten ja.
     neamBeskriv  function(arg) -> setning som forklarer hva som
                  kommer til aa skje. Vises i bekreftelsen.

   neamUtfor(navn, arg) - kjoerer verktoeyet og returnerer noe som
   taaler JSON.stringify. Kaster den, gaar feilen tilbake til Neam
   som et feilresultat, ikke til brukeren som en krasj.

   Mangler funksjonene, virker panelet fortsatt - Neam kan bare
   ikke se hvor du er eller gjoere noe.
   ------------------------------------------------------------

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
const NEAM_MODELL = 'claude-sonnet-5';

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

async function neamVerktoyliste(){
  const svar = await neamSpor('neamVerktoy');
  return Array.isArray(svar) ? svar : [];
}

function neamStedTekst(k){
  if(!k) return '';
  return [k.sted, k.visning].filter(Boolean).join(' \u00B7 ');
}

function neamSystem(k, harVerktoy){
  let s =
    'Du er Neam, husassistenten i familiens hub. Du svarer paa norsk (bokmaal), ' +
    'kort og konkret. Familien er Magne, Nina, Emma og Andrea.\n\n';

  if(harVerktoy){
    s += 'Du har verktoey for denne sida. Bruk dem heller enn aa gjette - vet du ' +
         'ikke hva som staar paa en liste, saa les den. Verktoey som endrer noe ' +
         'blir lagt fram for brukeren foer de kjoerer; avslaar brukeren, godtar ' +
         'du det og foreslaar noe annet.\n\n' +
         'Du har ingen andre veier inn i systemet enn verktoeyene. Finnes det ' +
         'ikke et som passer, si det - ikke lat som om noe er gjort.\n\n';
  }else{
    s += 'Du har ingen verktoey paa denne sida. Du kan bare snakke. Blir du bedt ' +
         'om aa gjoere noe, si hva du ville gjort og at det ikke er koblet paa ' +
         'her ennaa. Ikke lat som om noe er utfoert.\n\n';
  }

  s += 'Ikke gjett paa hva som staar i listene eller kalenderen.';
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
    model: NEAM_MODELL,
    max_tokens: 2000,
    /* NB: ikke sett temperature - modellen avviser den. */
    system: system,
    messages: meldinger
  };
  /* Vaare egne felter foelger ikke med ut - API-et avviser ukjente
     noekler i en verktoeydefinisjon. */
  if(verktoy.length){
    kropp.tools = verktoy.map(function(v){
      return { name:v.name, description:v.description, input_schema:v.input_schema };
    });
  }

  let r;
  try{
    r = await fetch('/api/claude', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(kropp)
    });
  }catch(e){
    const feil = new Error('Fikk ikke kontakt med Neam. Sjekk nettforbindelsen.');
    feil.kanProvesIgjen = true;
    throw feil;
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
    +     '<button type="button" class="neam-topp-knapp" id="neamNy">Ny samtale</button>'
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

function neamSkrivSted(k){
  const ut = document.getElementById('neamSted');
  if(ut) ut.textContent = neamStedTekst(k);
}

function neamLukk(){
  const bak = document.getElementById('neamBak');
  if(bak) bak.hidden = true;
}

async function neamNySamtale(){
  if(neamPoster.length &&
     !(await bekreft('Starte på nytt? Det som står her forsvinner.',
                     {jaTekst:'Start på nytt'}))) return;
  neamPoster = [];
  neamLagre();
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
      neamBoble(boks, m.role === 'user' ? 'meg' : 'bot', m.content);
      return;
    }

    (m.content || []).forEach(function(b){
      if(b.type === 'text' && String(b.text || '').trim()){
        neamBoble(boks, 'bot', b.text);
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

  if(neamVenter) neamBoble(boks, 'bot tenker', 'Neam tenker …');
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
  neamVenter = true;
  document.getElementById('neamSend').disabled = true;
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
    const system = neamSystem(k, defer.length > 0);

    let runde = 0;
    while(true){
      const svar = await neamKall(neamHistorikk(), system, defer);
      neamPoster.push({ api:{ role:'assistant', content:svar.content || [] } });
      neamLagre();
      neamTegn();

      if(svar.stop_reason !== 'tool_use') break;

      if(++runde > NEAM_MAKS_RUNDER){
        neamPoster.push({ feil:'Neam ble stående og gjenta seg selv, så jeg stoppet det.' });
        break;
      }

      const kall = (svar.content || []).filter(function(b){ return b.type === 'tool_use'; });
      const resultater = [];
      for(const b of kall) resultater.push(await neamKjor(b, defer));

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
    const send = document.getElementById('neamSend');
    if(send) send.disabled = false;
    neamLagre();
    neamTegn();
  }
}

/* ============================================================
   Oppstart
   ============================================================ */

if(document.body) neamBygg();
else document.addEventListener('DOMContentLoaded', neamBygg);
