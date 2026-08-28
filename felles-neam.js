/* ============================================================
   Neam - samtaleflaten (oppfoersel)
   ------------------------------------------------------------
   Haandtaket, panelet og samtalen mot /api/claude.
   Laget 28. august 2026.

   Fila monterer seg selv. Sida trenger bare aa laste den - ingen
   markup, ingen oppstartskall.

   ------------------------------------------------------------
   KONTRAKTEN MOT SIDA - den ene tingen som betyr noe

   Hver side definerer:

     window.neamKontekst = async function(){
       return { sted:'Handleliste', visning:'Forsiden', ... };
     };

   Den ER asynkron, og den skal vaere det selv om sida svarer med
   én gang i dag. Grunnen: kommer det en ramme (hub.html), gaar
   spoersmaalet over en dokumentgrense og maa gaa via postMessage,
   og et svar som kommer tilbake senere kan ikke returneres
   synkront. Skrives kallstedene med await naa, merker de
   flyttingen overhodet ikke. Skrives de synkrone, maa hvert
   eneste ett skrives om.

   Feltene er frie. Alt som kommer tilbake sendes med til Neam som
   JSON, saa en side kan utvide sin egen kontekst uten aa roere
   denne fila. Bare `sted` og `visning` leses her, og bare for aa
   skrives ut i topplinja.

   Mangler funksjonen, virker panelet fortsatt - Neam vet bare
   ikke hvor du er.
   ------------------------------------------------------------

   Samtalen ligger i sessionStorage, ikke i KV eller localStorage.
   Det er med vilje: den skal overleve at du gaar fra handlelista
   til kalenderen, og doe naar du lukker fana. Samme vurdering som
   kalenderens hurtigvalg - en samtale som overlever oekta blir en
   samtale du ikke husker at du startet.

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

/* {rolle:'meg'|'bot'|'feil', tekst} - 'feil' er vaare egne
   feilmeldinger og sendes aldri til API-et. */
let neamMeldinger = [];
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
    sessionStorage.setItem(NEAM_LAGER,
      JSON.stringify(neamMeldinger.slice(-NEAM_LAGRET)));
  }catch(e){ /* full eller avslaatt - samtalen lever ut sida uansett */ }
}

/* ============================================================
   Konteksten
   ============================================================ */

/* Sida svarer, eller den gjoer det ikke. En side uten kontrakt, en
   kontrakt som kaster, en kontrakt som aldri svarer - alle tre gir
   null, og panelet gaar videre uten. Neam skal ikke kunne henge paa
   at en side svarer daarlig. */
async function neamSted(){
  if(typeof window.neamKontekst !== 'function') return null;
  try{
    const svar = await Promise.race([
      Promise.resolve(window.neamKontekst()),
      new Promise(function(ok){ setTimeout(function(){ ok(null); }, 2000); })
    ]);
    return (svar && typeof svar === 'object') ? svar : null;
  }catch(e){
    console.warn('neamKontekst() feilet:', e);
    return null;
  }
}

function neamStedTekst(k){
  if(!k) return '';
  const deler = [k.sted, k.visning].filter(Boolean);
  return deler.join(' · ');
}

function neamSystem(k){
  let s =
    'Du er Neam, husassistenten i familiens hub. Du svarer paa norsk (bokmaal), ' +
    'kort og konkret. Familien er Magne, Nina, Emma og Andrea.\n\n' +
    'Du kan foreloepig bare snakke. Du har ingen tilgang til aa endre noe i ' +
    'appene, styre lys eller lese data utover det som staar nedenfor. Blir du ' +
    'bedt om aa gjoere noe, si hva du ville gjort og at handlingene ikke er ' +
    'koblet paa ennaa. Ikke lat som om noe er utfoert.\n\n' +
    'Ikke gjett paa hva som staar i listene eller kalenderen. Vet du det ikke, ' +
    'si det.';
  if(k){
    s += '\n\nHer staar brukeren akkurat naa:\n' + JSON.stringify(k, null, 1);
  }else{
    s += '\n\nDu vet ikke hvilken side brukeren staar paa.';
  }
  return s;
}

/* ============================================================
   Kallet
   ============================================================ */

/* Svaret leses som tekst foer det tolkes som JSON. Gaar tjenesten ned,
   kommer det en HTML-side eller en tom kropp i retur, og response.json()
   kaster da en melding som ikke sier noe om hva som skjedde. Samme
   laerdom som i oppskrifter. */
async function neamEttForsok(meldinger, system){
  let r;
  try{
    r = await fetch('/api/claude', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        model: NEAM_MODELL,
        max_tokens: 1500,
        /* NB: ikke sett temperature - modellen avviser den. */
        system: system,
        messages: meldinger
      })
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

  const tekst = (d.content || [])
    .filter(function(b){ return b.type === 'text'; })
    .map(function(b){ return b.text; })
    .join('\n').trim();
  if(!tekst) throw new Error('Neam svarte uten tekst.');
  return tekst;
}

/* Ett nytt forsoek ved forbigaaende feil. Ekte feil fra API-et prøves
   ikke om igjen - da er svaret det samme neste gang. */
async function neamKall(meldinger, system){
  try{
    return await neamEttForsok(meldinger, system);
  }catch(e){
    if(!e.kanProvesIgjen) throw e;
    await new Promise(function(ok){ setTimeout(ok, 1200); });
    return await neamEttForsok(meldinger, system);
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

  neamMeldinger = neamHent();
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
  const k = await neamSted();
  const ut = document.getElementById('neamSted');
  if(ut) ut.textContent = neamStedTekst(k);
}

function neamLukk(){
  const bak = document.getElementById('neamBak');
  if(bak) bak.hidden = true;
}

async function neamNySamtale(){
  if(neamMeldinger.length &&
     !(await bekreft('Starte på nytt? Det som står her forsvinner.',
                     {jaTekst:'Start på nytt'}))) return;
  neamMeldinger = [];
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
   ============================================================ */

function neamTegn(){
  const boks = document.getElementById('neamSamtale');
  if(!boks) return;
  boks.innerHTML = '';

  if(!neamMeldinger.length && !neamVenter){
    const tom = document.createElement('p');
    tom.className = 'neam-tom';
    tom.textContent = 'Neam vet hvilken side du står på. '
                    + 'Spør om noe, så ser vi hvor langt vi kommer.';
    boks.appendChild(tom);
    return;
  }

  neamMeldinger.forEach(function(m){
    const el = document.createElement('div');
    el.className = 'neam-melding ' + (m.rolle === 'meg' ? 'meg'
                                    : m.rolle === 'feil' ? 'feil' : 'bot');
    el.textContent = m.tekst;
    boks.appendChild(el);
  });

  if(neamVenter){
    const el = document.createElement('div');
    el.className = 'neam-melding bot tenker';
    el.textContent = 'Neam tenker …';
    boks.appendChild(el);
  }

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

  neamMeldinger.push({ rolle:'meg', tekst:tekst });
  neamVenter = true;
  document.getElementById('neamSend').disabled = true;
  neamLagre();
  neamTegn();

  try{
    /* Konteksten hentes paa nytt for hver melding, ikke én gang ved
       aapning: panelet staar oppe mens du kan ha byttet visning bak
       det. Den ligger i systemteksten, som bygges paa nytt hvert kall,
       saa historikken holder seg ren for stedsbeskrivelser. */
    const k = await neamSted();
    const ut = document.getElementById('neamSted');
    if(ut) ut.textContent = neamStedTekst(k);

    const historikk = neamMeldinger
      .filter(function(m){ return m.rolle !== 'feil'; })
      .slice(-NEAM_SENDT)
      .map(function(m){
        return { role: m.rolle === 'meg' ? 'user' : 'assistant', content: m.tekst };
      });

    const svar = await neamKall(historikk, neamSystem(k));
    neamMeldinger.push({ rolle:'bot', tekst:svar });
  }catch(e){
    console.warn('Neam:', e);
    neamMeldinger.push({ rolle:'feil', tekst:e.message || 'Noe gikk galt.' });
  }finally{
    /* I finally, ikke etter kallet: ryker noe uventet, skal panelet
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
