/* ============================================================
   Neam - avbryt-regelen
   ------------------------------------------------------------
   Avbryt er alltid noeytral - roedt er reservert for sletting.
   Advarselen ligger derfor ikke i fargen, men i en bekreftelse,
   og bare naar det finnes noe aa miste: tekst, tall eller filer
   som er lagt inn siden skjemaet ble aapnet. Valg i nedtrekk og
   avkryssinger teller ikke - de koster ingenting aa gjoere om.
   Er ingenting endret, gaar Avbryt rett ut uten dialog: en dialog
   man faar hver gang, er en dialog man slutter aa lese.

   Trukket ut 28. august 2026 (7.3, femte flytting). Regelen var
   skrevet tre ganger, i dashboard, handleliste og oppskrifter, og
   en endring i den maatte gjoeres tre steder.

     huskSkjema('avtaleBoks')                  naar skjemaet aapnes
     avbrytSkjema('avtaleBoks', lukkAvtale)    paa Avbryt-knappen

   FORVENTER av sida som laster fila:
     bekreft()  - fra felles-dialog.js, som maa lastes FOER denne

   Lastes FOER sidens eget skript.
   ============================================================ */

/* Avtrykket av hvert skjema, tatt da det ble aapnet. */
const modalAvtrykk = {};

/* Noe hoerer til et skjema uten aa ligge i et felt - vedlegg og bilder
   samles i JS-lister, og filfeltet nullstilles saa snart fila er lest.
   Uten dette registeret ville "legg ved en fil, trykk Avbryt" gaatt
   stille gjennom.

   Sida melder inn sine egne, etter at fila er lastet:
     ekstraTilstand['avtaleBoks'] = function(){ return nyeFiler.length; };

   Meld bare inn brukerens egne handlinger. En liste som fylles av et
   bakgrunnskall ETTER at avtrykket er tatt, endrer seg av seg selv og
   gir et spoersmaal ingen har fortjent. */
const ekstraTilstand = {};

/* document.getElementById, ikke $(): handleliste har ingen $-hjelper, og
   en fellesfil skal ikke kreve at sida har en bestemt forkortelse. */
function avtrykkAv(id){
  const rot = document.getElementById(id);
  if(!rot) return '';
  const felt = rot.querySelectorAll('textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color])');
  const ekstra = ekstraTilstand[id] ? String(ekstraTilstand[id]()) : '';
  return Array.from(felt).map(function(el){ return el.value; }).join('\u241F') + '\u241E' + ekstra;
}

function huskSkjema(id){ modalAvtrykk[id] = avtrykkAv(id); }

function skjemaEndret(id){
  const foer = modalAvtrykk[id];
  return foer != null && avtrykkAv(id) !== foer;
}

/* lukk er funksjonen som faktisk lukker - hver modal har sin egen
   opprydding, og den blir liggende i sida. */
async function avbrytSkjema(id, lukk){
  if(skjemaEndret(id) &&
     !(await bekreft('Du har fylt inn noe som ikke er lagret. Forkaster du det nå, er det borte.',
                     {jaTekst:'Forkast', fare:true}))) return;
  lukk();
}
