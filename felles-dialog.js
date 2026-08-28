/* ============================================================
   Neam - felles dialoger (oppfoersel)
   ------------------------------------------------------------
   Erstatter nettleserens confirm() og alert(). Trukket ut
   28. august 2026.

     await bekreft('Slette avtalen?', {jaTekst:'Slett', fare:true})
       -> true / false
     varsle('Fikk ikke lagret: ...')
       -> viser en melding med én knapp; trenger ikke ventes paa

   bekreft() er asynkron der confirm() var synkron, saa kallstedet
   maa vaere async og bruke await. Det er hele forskjellen.

   Markupen lages her, én gang, ved foerste bruk. Ingen side
   trenger aa ha noe liggende i HTML-en.

   Lastes FOER sidens eget skript. Utseendet ligger i
   felles-dialog.css.
   ============================================================ */

let dlgBak = null;
let dlgSvar = null;      /* resolve-funksjonen til dialogen som staar oppe */

function dlgBygg(){
  if(dlgBak) return dlgBak;

  dlgBak = document.createElement('div');
  dlgBak.className = 'dlg-bak';
  dlgBak.hidden = true;
  dlgBak.innerHTML =
      '<div class="dlg-kort" role="alertdialog" aria-modal="true">'
    +   '<p class="dlg-tekst"></p>'
    +   '<div class="dlg-rad">'
    +     '<button type="button" class="dlg-knapp nei"></button>'
    +     '<button type="button" class="dlg-knapp ja"></button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(dlgBak);

  dlgBak.querySelector('.nei').onclick = function(){ dlgLukk(false); };
  dlgBak.querySelector('.ja').onclick  = function(){ dlgLukk(true);  };

  /* Klikk paa bakgrunnen teller som avbryt, slik modalene ellers gjoer.
     Escape ogsaa - en dialog man ikke kommer ut av er verre enn ingen. */
  dlgBak.onclick = function(ev){ if(ev.target === dlgBak) dlgLukk(false); };
  document.addEventListener('keydown', function(ev){
    if(!dlgBak || dlgBak.hidden) return;
    if(ev.key === 'Escape') dlgLukk(false);
  });

  return dlgBak;
}

function dlgLukk(svar){
  if(!dlgBak) return;
  dlgBak.hidden = true;
  const f = dlgSvar;
  dlgSvar = null;
  if(f) f(svar);
}

function dlgVis(tekst, valg){
  const v = valg || {};
  const el = dlgBygg();
  el.querySelector('.dlg-tekst').textContent = String(tekst || '');

  const nei = el.querySelector('.nei');
  const ja  = el.querySelector('.ja');

  nei.hidden = !!v.bareEn;
  nei.textContent = v.neiTekst || 'Avbryt';
  ja.textContent  = v.jaTekst  || (v.bareEn ? 'OK' : 'Ja');
  ja.classList.toggle('fare', !!v.fare);

  /* Staar det alt en dialog oppe, svarer den nei foer den nye tar over -
     ellers blir det foerste kallet hengende og venter i det uendelige. */
  if(dlgSvar){ const gammel = dlgSvar; dlgSvar = null; gammel(false); }

  el.hidden = false;
  ja.focus();

  return new Promise(function(ok){ dlgSvar = ok; });
}

/* Ja/nei. Returnerer true bare naar noen faktisk trykker den bekreftende
   knappen - bakgrunnsklikk og Escape er nei, som i en vanlig modal. */
function bekreft(tekst, valg){
  return dlgVis(tekst, valg || {});
}

/* Én knapp, ingenting aa velge. Kan ventes paa, men trenger det ikke. */
function varsle(tekst, valg){
  const v = valg || {};
  v.bareEn = true;
  return dlgVis(tekst, v);
}
