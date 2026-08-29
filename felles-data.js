/* ============================================================
   Neam - felles datalag
   ------------------------------------------------------------
   Lesing paa tvers av appene, rett mot KV. Startet 29. august
   2026 med husregisteret; lesHandleliste/lesOppskrifter/
   lesKatalog kommer i samme fil naar Neam skal se hele huset
   fra hvilken som helst side.

   Dette er IKKE en omskriving av sidenes egen lagring. Sidene
   eier fortsatt sine egne data og skriver dem selv - fila her
   er en leseluke for den som staar et annet sted. Skriving
   finnes bare for husregisteret, som ingen side eier fra foer.

   Lastes FOER sidens eget skript.
   ============================================================ */

/* Cloudflare-funksjonen bak Access. GET svarer {value: ...},
   PUT tar verdien raa i kroppen. Samme kontrakt som sidenes egne
   cloudGet/cloudSet - den er gjentatt her og ikke gjenbrukt, fordi
   sidenes utgaver ligger inne i lukkinger med IndexedDB-speiling
   som ingen annen side skal arve. */
const DATA_API = '/api/data';

async function dataLes(nokkel){
  const r = await fetch(DATA_API + '?key=' + encodeURIComponent(nokkel),
                        {headers:{'Accept':'application/json'}, cache:'no-store'});
  if(!r.ok) throw new Error('KV les ' + r.status);
  const d = await r.json();
  return (d && d.value !== undefined) ? d.value : null;
}

async function dataSkriv(nokkel, verdi){
  const r = await fetch(DATA_API + '?key=' + encodeURIComponent(nokkel), {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(verdi)
  });
  if(!r.ok) throw new Error('KV skriv ' + r.status);
  return true;
}

/* ============================================================
   Husregisteret
   ------------------------------------------------------------
   Det huset alltid er sant om seg selv, lagt inn i systemteksten
   til Neam paa hver side. Uten det gjetter han: han spoer om salt
   skal med, foreslaar aa kjoepe vann, og basisvare-bolken i
   importtabellen staar tom fordi ingenting er kjent som basisvare.

   Fritekst per bolk, ikke rader med felter. Leseren er en
   spraakmodell, og tekst er formatet den leser best. Struktur
   maatte uansett bygges om foerste gang noe ikke passet inn i
   radene - «Emma spiser fisk hvis den ikke ser ut som fisk» er
   en setning, ikke et felt. Skal ekte kode en dag vite om noe er
   en basisvare, ligger det flagget alt paa varen i katalogen.

   NB: dette er ikke det samme som `foeringer` i KV. Den nokkelen
   baerer regler for hva som er SAMME VARE ved import, og leses i
   dag bare av frakoblede kortGjennomgang() i oppskrifter. Ryddes
   sammen med den; den skal ikke smelte inn her uten at noen har
   bestemt det.
   ============================================================ */

const HUSREGISTER_NOKKEL = 'husregister:v1';

/* Rekkefoelgen her er rekkefoelgen i skjemaet OG i teksten Neam
   faar. `ledetekst` er det som staar over feltet, `forklaring`
   den lille linja under, og `overskrift` det Neam ser. */
const HUS_BOLKER = [
  {
    id: 'alltid',
    ledetekst: 'Dette har huset alltid',
    forklaring: 'Ting det ikke er noe poeng i aa sette paa lista. Vann, salt, mel.',
    overskrift: 'DETTE HAR HUSET ALLTID. Det trenger ikke kjoepes eller staa paa '
              + 'handlelista med mindre noen uttrykkelig sier at det er tomt'
  },
  {
    id: 'aldri',
    ledetekst: 'Dette kjøpes aldri',
    forklaring: 'Ting huset ikke vil ha, uansett hvem som foreslaar det.',
    overskrift: 'DETTE KJOEPES ALDRI. Foreslaa det ikke, og ta det bort hvis det '
              + 'dukker opp i en import'
  },
  {
    id: 'kosthold',
    ledetekst: 'Hvem spiser ikke hva',
    forklaring: 'Allergier, vegetarisk, sterk motvilje. Ett navn per linje.',
    overskrift: 'KOSTHOLD I HUSET. Ta hensyn til dette naar du foreslaar mat, og si '
              + 'fra hvis en oppskrift kolliderer med det'
  },
  {
    id: 'butikker',
    ledetekst: 'Butikker som gjelder',
    forklaring: 'Hvor huset handler til vanlig, og hva som kjoepes hvor.',
    overskrift: 'BUTIKKER HUSET BRUKER'
  },
  {
    id: 'annet',
    ledetekst: 'Annet Neam bør vite',
    forklaring: 'Alt som ikke passer over, men som du blir lei av aa gjenta.',
    overskrift: 'ANNET OM HUSET'
  }
];

/* Hentes én gang per sidelasting. Fem kall til neamBakgrunn i samme
   oekt skal ikke bli fem KV-kall - og neamSpor gir opp etter to
   sekunder, saa svaret maa vaere raskt fra andre gang. */
let husregisterBuffer = null;

async function lesHusregister(friskt){
  if(!friskt && husregisterBuffer) return husregisterBuffer;
  let d = null;
  try{ d = await dataLes(HUSREGISTER_NOKKEL); }catch(e){
    /* Nede eller tom nokkel: et tomt register er riktigere enn en
       feil som stopper panelet. Neam mister kunnskap, ikke stemme. */
    console.warn('Fikk ikke lest husregisteret:', e);
    return {};
  }
  if(typeof d === 'string'){ try{ d = JSON.parse(d); }catch(e){ d = null; } }
  husregisterBuffer = (d && typeof d === 'object') ? d : {};
  return husregisterBuffer;
}

async function skrivHusregister(reg){
  const rent = {};
  HUS_BOLKER.forEach(function(b){
    const v = String((reg && reg[b.id]) || '').trim();
    if(v) rent[b.id] = v;
  });
  await dataSkriv(HUSREGISTER_NOKKEL, rent);
  husregisterBuffer = rent;
  return rent;
}

/* Blokka som legges inn i sidenes neamBakgrunn. Tomme bolker
   utelates helt - en overskrift uten innhold er stoey, og en modell
   som ser «DETTE KJOEPES ALDRI:» med ingenting under kan like
   gjerne lese det som at ingenting er forbudt enn at ingen har
   fylt det ut. Er alt tomt, kommer det ingen blokk. */
async function husregisterTekst(){
  const reg = await lesHusregister();
  const deler = [];
  HUS_BOLKER.forEach(function(b){
    const v = String(reg[b.id] || '').trim();
    if(v) deler.push(b.overskrift + ':\n' + v);
  });
  if(!deler.length) return '';
  return 'OM HUSET\n'
       + 'Dette er husets eget register, ført av familien på forsiden. '
       + 'Det gjelder uansett hvilken side du står på, og det går foran '
       + 'det du ellers ville antatt.\n\n'
       + deler.join('\n\n');
}
