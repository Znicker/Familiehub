/* ============================================================
   Familie Hub - felles filviser (oppfoersel)
   ------------------------------------------------------------
   Brukes av dashboard og kalender. Trukket ut 27. august 2026
   (7.3, tredje flytting). Der de to versjonene sprikte, vant
   dashboardets - den var gjennomgaaende den mer robuste. Hvert
   avvik er kommentert der det staar.

   Lastes FOER sidens eget skript. Fila kaller $(id) og forventer
   markupen med id-ene filviser, filviserNavn og filviserInn -
   begge sidene har den identisk.

   Blir liggende i sidene, med vilje:
   - aapneVedleggFra() - kaller graph(), som fortsatt har to ulike
     signaturer, og viser feil paa hver sin maate
   - valgteFiler()     - to forskjellige funksjoner mot hver sin
     vedleggsliste, ikke to skrivemaater av én
   ============================================================ */

let viserUrl = null;

/* Et vedlegg kan ogsaa vaere en avtale eller en e-post lagt ved.
   Bare vanlige filvedlegg kan vises.
   Merk: mangler typen helt, antar vi fil. Kalenderversjonen gjorde
   det, dashboardversjonen ikke - og det strengeste valget ville
   skjult vedlegg der Graph utelater feltet. */
function erFil(v){
  const type = String(v && v['@odata.type'] || '');
  if(!type) return true;
  return type.indexOf('fileAttachment') >= 0;
}

function erBilde(a){
  if(!erFil(a)) return false;
  if(a.contentType && /^image\//i.test(a.contentType)) return true;
  /* Outlook sender av og til bilder som generisk filtype, saa navnet
     faar avgjoere naar typen ikke sier noe. */
  return /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)$/i.test(a.name || '');
}

/* Kalenderversjonen manglet erFil-sjekken helt, og kunne dermed ta en
   vedlagt avtale med .pdf i navnet for en PDF. */
function erPdf(a){
  if(!erFil(a)) return false;
  if(a.contentType && /pdf/i.test(a.contentType)) return true;
  return /\.pdf$/i.test(a.name || '');
}

/* Lager en blob av base64-innholdet fra Graph.
   `bytes || ''` er dashboardets: uten den kaster atob paa et vedlegg
   som kom uten innhold. */
function blobAv(bytes, type){
  const bin = atob(bytes || '');
  const buf = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: type || 'application/octet-stream' });
}

function filTilBase64(fil){
  return new Promise(function(ok, nei){
    const r = new FileReader();
    /* `|| ''` er dashboardets: en tom fil ga ellers undefined videre. */
    r.onload  = function(){ ok(String(r.result).split(',')[1] || ''); };
    r.onerror = function(){ nei(new Error('Kunne ikke lese ' + fil.name)); };
    r.readAsDataURL(fil);
  });
}

function lukkViser(){
  const v = $('filviser');
  if(v) v.hidden = true;
  const inn = $('filviserInn');
  if(inn) inn.innerHTML = '';
  if(viserUrl){ URL.revokeObjectURL(viserUrl); viserUrl = null; }
}

function lastNedFraViser(){
  const v = $('filviser');
  if(!v || !viserUrl) return;
  const a = document.createElement('a');
  a.href = viserUrl;
  a.download = v.dataset.navn || 'vedlegg';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function aapneViser(a){
  if(viserUrl) URL.revokeObjectURL(viserUrl);
  viserUrl = URL.createObjectURL(blobAv(a.contentBytes, a.contentType));

  const v = $('filviser');
  v.dataset.navn = a.name || 'vedlegg';
  $('filviserNavn').textContent = a.name || '';

  const inn = $('filviserInn');
  inn.innerHTML = '';

  if(erBilde(a)){
    const img = document.createElement('img');
    img.src = viserUrl;
    img.alt = a.name || '';
    inn.appendChild(img);
  }else if(erPdf(a)){
    const ramme = document.createElement('iframe');
    ramme.src = viserUrl;
    ramme.title = a.name || 'PDF';
    inn.appendChild(ramme);
  }else{
    /* Kan ikke vises - da er nedlasting det eneste fornuftige */
    lastNedFraViser();
    lukkViser();
    return;
  }
  v.hidden = false;
}

/* Forhaandsvisning av et vedlegg vi allerede har innholdet til.
   Bilder vises som bilde, PDF som en liten side man kan bla i.
   Resten staar som en rad man kan aapne. */
function tegnForhaand(a, boks){
  const ramme = document.createElement('figure');
  ramme.className = 'vedlegg-bilde';

  const kilde = 'data:' + (a.contentType || 'application/octet-stream')
              + ';base64,' + a.contentBytes;

  if(erPdf(a)){
    const vis = document.createElement('iframe');
    vis.className = 'vedlegg-pdf';
    vis.src = kilde + '#toolbar=0&navpanes=0&view=FitH';
    vis.title = a.name || 'PDF';
    ramme.appendChild(vis);
  }else{
    const vis = document.createElement('img');
    vis.src = kilde;
    vis.alt = a.name || '';
    vis.loading = 'lazy';
    vis.onclick = function(ev){ ev.stopPropagation(); aapneViser(a); };
    ramme.appendChild(vis);
  }

  const tekst = document.createElement('figcaption');
  tekst.textContent = a.name || '';
  ramme.appendChild(tekst);

  const aapne = document.createElement('button');
  aapne.type = 'button';
  aapne.className = 'vedlegg-aapne';
  aapne.textContent = 'Åpne i full størrelse';
  aapne.onclick = function(ev){ ev.stopPropagation(); aapneViser(a); };
  ramme.appendChild(aapne);

  boks.appendChild(ramme);
  return ramme;
}
