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

/* ============================================================
   Matlaging - lesing utenfra
   ------------------------------------------------------------
   Oppskriftsboka skriver noklene sine gjennom en fullKey() som
   setter `p:` foran (privat) eller `s:` (delt). Prefikset er et
   internt handtak i den appen, og at det maa staa her er en
   lekkasje fra dens indre. Skrevet ned med vilje: det er ett av
   argumentene for datalag-refaktoriseringen i del 14, ikke noe
   som skal se pent ut.

   Verdiene i KV er JSON-STRENGER, ikke objekter - window.storage
   i oppskrifter stringifyer for lagring. Derfor parses de her.

   MERK: varekatalogen leses IKKE herfra. Handleliste har sin egen
   under `vare-katalog` (uten prefiks), Matlaging sin under
   `p:vare-katalog`. Det er to kataloger som holdes i takt manuelt
   med «Last ned katalogen» og «Slaa sammen» - ikke én delt. Skal
   de bli én, er det en beslutning, ikke en leserfunksjon.
   ============================================================ */

const OPPSKRIFT_INDEKS = 'p:recipe-index';
const OPPSKRIFT_NOKKEL = 'p:recipe:';
const UKEPLAN_NOKKEL   = 'p:meal-plan';

async function lesJson(nokkel){
  let d = null;
  try{ d = await dataLes(nokkel); }catch(e){
    console.warn('Fikk ikke lest ' + nokkel + ':', e);
    return null;
  }
  if(typeof d === 'string'){ try{ d = JSON.parse(d); }catch(e){ return null; } }
  return d;
}

/* Oppskriftslista uten miniatyrbildene.

   `thumb` er et base64-bilde per oppskrift. Med femti oppskrifter er
   indeksen flere megabyte, og alt av det ville gaatt rett inn i
   samtalen hvis lista ble sendt som den er. Ingen skal kunne kalle
   dette og ved et uhell fylle konteksten med bilder.

   Bufret i 60 sekunder. Bildene strippes HER, altsaa etter at hele
   indeksen er lastet ned - kostnaden er nettverket, ikke konteksten,
   og tre soek etter hverandre lastet den tre ganger. Kort levetid og
   ikke evig: en oppskrift lagt inn i en annen fane skal dukke opp
   uten at sida lastes paa nytt. */
let indeksBuffer = null;
let indeksTid = 0;

async function lesOppskriftsindeks(){
  if(indeksBuffer && (Date.now() - indeksTid) < 60000) return indeksBuffer;
  const d = await lesJson(OPPSKRIFT_INDEKS);
  if(!Array.isArray(d)) return [];
  indeksBuffer = d.map(function(r){
    return {
      id: r.id,
      tittel: r.title || 'Uten navn',
      tid: r.time || '',
      kategorier: r.categories || [],
      terningkast: r.rating || null
    };
  });
  indeksTid = Date.now();
  return indeksBuffer;
}

/* Fritekstsoek i indeksen. Ingen fuzzy-logikk: smaa bokstaver og
   delstreng paa tittel og kategori. Treffer det ikke, er det bedre
   at Neam faar tom liste og spoer, enn at han faar noe som ligner. */
async function finnOppskrifter(sok){
  const alle = await lesOppskriftsindeks();
  const q = String(sok || '').toLowerCase().trim();
  if(!q) return alle;
  return alle.filter(function(r){
    if(String(r.tittel).toLowerCase().indexOf(q) !== -1) return true;
    return (r.kategorier || []).some(function(k){
      return String(k).toLowerCase().indexOf(q) !== -1;
    });
  });
}

/* Én oppskrift, uten bilder.

   Samme grunn som over, men verre: en enkelt oppskrift kan vaere
   4,5 MB fordi rettbildet og hvert stegbilde ligger som base64 inne
   i objektet. Feltene fjernes her og ikke hos kallstedet - et filter
   man maa huske aa bruke er et filter som glemmes. */
async function lesOppskrift(id){
  if(!id) return null;
  const r = await lesJson(OPPSKRIFT_NOKKEL + id);
  if(!r || typeof r !== 'object') return null;
  return {
    id: r.id,
    tittel: r.title || 'Uten navn',
    porsjoner: r.baseServings || null,
    tid: r.time || '',
    kategorier: r.categories || [],
    ingredienser: (r.ingredients || []).map(function(i){
      return {
        navn: i.name,
        /* amount er tall, amountText er det som ikke lot seg regne paa
           («en klype», «1/2»). Bare én av dem er satt. */
        mengde: (i.amount != null) ? i.amount : (i.amountText || ''),
        enhet: i.unit || '',
        allergener: i.allergens || [],
        seksjon: i.section || ''
      };
    }),
    steg: (r.steps || []).map(function(s){ return s.text; }).filter(Boolean),
    tips: (r.tips || []).map(function(t){ return (t && t.text) || t; }).filter(Boolean)
  };
}

/* ISO-uke. Gjentatt fra oppskrifter.html med vilje: aatte linjer ren
   regning uten sideeffekter, og aa hente dem derfra ville bundet
   fellesfila til at den ene sida er lastet. */
function isoUkeAv(dato){
  const d = new Date(Date.UTC(dato.getFullYear(), dato.getMonth(), dato.getDate()));
  const dagNr = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dagNr);
  const aarStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { aar: d.getUTCFullYear(), uke: Math.ceil(((d - aarStart) / 86400000 + 1) / 7) };
}

function ukeNokkel(u){
  return u.aar + '-W' + String(u.uke).padStart(2, '0');
}

const UKEDAGER = ['', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag',
                  'lørdag', 'søndag'];

/* Ukeplanen for én uke. Uten argument: inneværende uke.
   Svaret er dager med navn, ikke tall - «torsdag» leses av alle,
   «4» maa slaas opp. */
async function lesUkeplan(nokkel){
  const alle = await lesJson(UKEPLAN_NOKKEL);
  const n = nokkel || ukeNokkel(isoUkeAv(new Date()));
  const uke = (alle && typeof alle === 'object' && alle[n]) || {};
  const dager = [];
  for(let i = 1; i <= 7; i++){
    const retter = uke[i] || uke[String(i)] || [];
    if(!retter.length) continue;
    dager.push({
      dag: UKEDAGER[i],
      retter: retter.map(function(r){
        return { id: r.id, tittel: r.title || 'Uten navn', porsjoner: r.servings || null };
      })
    });
  }
  return { uke: n, dager: dager };
}
