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

   NAVNEREGELEN HER: alt som ikke er ment aa kalles utenfra baerer
   `hus`/`HUS_`. Det er ikke pynt. Uten prefiks kolliderte tre av
   dem med navn som alt fantes i sidene - `UKEDAGER` og `ukeNokkel`
   i dashboard og `mengdeTekst` i handleliste - og dashboards
   `ukeNokkel(dato)` betydde til og med noe annet enn vaar
   `husUkeNokkel({aar, uke})`. En `const` som deklareres to ganger
   er en SyntaxError som stopper HELE skriptet i sida, uten at noe
   annet peker paa aarsaken. Samme felle som `LANDSKAP` i sin tid.
   En fellesfil som lastes av fem sider maa regne med at alle
   vanlige norske ord alt er tatt.
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

async function husLesJson(nokkel){
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
  const d = await husLesJson(OPPSKRIFT_INDEKS);
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
  const r = await husLesJson(OPPSKRIFT_NOKKEL + id);
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

/* ============================================================
   Handlelista - lesing utenfra
   ------------------------------------------------------------
   Noklene her har INGEN prefiks - handleliste skriver rett mot
   `handleliste:v1`, mens Matlaging gar gjennom fullKey() og far
   `p:`. To apper, to konvensjoner, samme KV. Ogsa dette er et
   argument for datalag-refaktoriseringen, ikke et onske.

   Erstatter hentEksisterendeVarer() i oppskrifter, som gjorde
   halve denne jobben. Den skal kobles av naar dette har staatt en
   stund - ikke bli en fjerde kopi.

   HVILKEN HANDLETUR SOM ER AAPEN kan ikke leses utenfra. Det
   valget ligger i handlelistas eget minne per enhet (viewOktId),
   ikke i dataene. Derfor gis alle levende turer, og den som spor
   maa si hvilken - eller ta den nyeste, som er det vi gjor her.
   ============================================================ */

const HANDLELISTE_NOKKEL = 'handleliste:v1';

function husMengdeTekst(count, amt, unit){
  const c = count ? String(count).trim() : '';
  const a = amt   ? String(amt).trim()   : '';
  const u = unit  ? String(unit).trim()  : '';
  const m = a ? (a + (u ? ' ' + u : '')).trim() : '';
  if(c && m) return c + ' \u00D7 ' + m;
  if(c)      return c + ' stk';
  return m;
}

/* En tur som er avsluttet uten aa ha vaert startet er forkastet -
   den skal ikke telle som noe som staar paa lista. Samme regel som
   hentEksisterendeVarer() i oppskrifter brukte. */
function husLevendeTurer(d){
  return (d.okter || []).filter(function(o){
    return o && !(o.avsluttet && !o.startet);
  });
}

async function lesHandleliste(omrade){
  const d = await husLesJson(HANDLELISTE_NOKKEL);
  if(!d || !Array.isArray(d.items)) return { handleturer: [], varer: [] };

  const turer = husLevendeTurer(d).filter(function(o){
    return !omrade || (o.omrade || 'mat') === omrade;
  }).sort(function(a, b){ return (a.opprettet || 0) - (b.opprettet || 0); });

  const tell = {};
  d.items.forEach(function(v){
    if(!tell[v.oktId]) tell[v.oktId] = {antall:0, gjenstaar:0};
    tell[v.oktId].antall++;
    if(!v.done) tell[v.oktId].gjenstaar++;
  });

  const levende = {};
  turer.forEach(function(o){ levende[o.id] = o; });

  return {
    handleturer: turer.map(function(o){
      return {
        navn: o.navn || 'Uten navn',
        omrade: (o.omrade || 'mat') === 'annet' ? 'Andre varer' : 'Dagligvarer',
        antall: (tell[o.id] || {}).antall || 0,
        gjenstaar: (tell[o.id] || {}).gjenstaar || 0
      };
    }),
    varer: d.items.filter(function(v){ return levende[v.oktId]; })
      .map(function(v){
        return {
          vare: v.name,
          mengde: husMengdeTekst(v.count, v.amt, v.unit) || v.qty || '',
          type: v.cat || '',
          butikk: v.store || '',
          kjopt: !!v.done,
          handletur: (levende[v.oktId].navn) || 'Uten navn',
          omrade: (levende[v.oktId].omrade || 'mat') === 'annet'
                    ? 'Andre varer' : 'Dagligvarer'
        };
      })
  };
}

/* ISO-uke. Gjentatt fra oppskrifter.html med vilje: aatte linjer ren
   regning uten sideeffekter, og aa hente dem derfra ville bundet
   fellesfila til at den ene sida er lastet. */
function husIsoUke(dato){
  const d = new Date(Date.UTC(dato.getFullYear(), dato.getMonth(), dato.getDate()));
  const dagNr = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dagNr);
  const aarStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { aar: d.getUTCFullYear(), uke: Math.ceil(((d - aarStart) / 86400000 + 1) / 7) };
}

function husUkeNokkel(u){
  return u.aar + '-W' + String(u.uke).padStart(2, '0');
}

const HUS_UKEDAGER = ['', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag',
                  'lørdag', 'søndag'];

/* Ukeplanen for én uke. Uten argument: inneværende uke.
   Svaret er dager med navn, ikke tall - «torsdag» leses av alle,
   «4» maa slaas opp. */
async function lesUkeplan(nokkel){
  const alle = await husLesJson(UKEPLAN_NOKKEL);
  const n = nokkel || husUkeNokkel(husIsoUke(new Date()));
  const uke = (alle && typeof alle === 'object' && alle[n]) || {};
  const dager = [];
  for(let i = 1; i <= 7; i++){
    const retter = uke[i] || uke[String(i)] || [];
    if(!retter.length) continue;
    dager.push({
      dag: HUS_UKEDAGER[i],
      retter: retter.map(function(r){
        return { id: r.id, tittel: r.title || 'Uten navn', porsjoner: r.servings || null };
      })
    });
  }
  return { uke: n, dager: dager };
}

/* ============================================================
   Husets leseverktoey - de samme paa alle fem sidene
   ------------------------------------------------------------
   «Les overalt, skriv der du staar.» Lesing paa tvers har ingen
   god grunn til aa vaere begrenset: det er husets egne data, og
   alle fem sidene staar bak samme innlogging. En vegg mellom
   sidene beskytter ingen - den gjoer bare Neam dummere paa fire
   av fem steder.

   Skriving er en annen sak, og gaar fortsatt bare der sida eier
   dataene. Ikke fordi det er farlig, men fordi hver side holder
   sin egen kopi i minnet: en skriving til handlelistas KV-nokkel
   fra Matlaging ville gitt en handleliste som viser noe annet enn
   det som er lagret, helt til den lastes paa nytt. Innboksen
   loeser det, og den finnes.

   Slik kobles de paa i en side:

     window.neamVerktoy = async function(){
       return [ ...sidens egne..., ...HUS_VERKTOY ];
     };
     window.neamUtfor = async function(navn, arg){
       ...sidens egne...
       const h = await husUtfor(navn, arg);
       if(h) return h.svar;
       throw new Error('Ukjent verktoey: ' + navn);
     };

   husUtfor returnerer {svar} eller null - ikke svaret rett, saa
   et verktoey som med rette svarer null ikke leses som «ikke
   mitt». Sidene skal legge HUS_VERKTOY SIST, saa et sidenavn
   vinner ved en eventuell navnekollisjon.
   ============================================================ */

const HUS_VERKTOY = [
  {
    name: 'finn_oppskrift',
    description: 'Søker i Oppskriftsboka (Matlaging) etter tittel eller kategori og '
               + 'gir treff med tittel, id, tid og kategorier. Ingen ingredienser - '
               + 'bruk les_oppskrift på id-en for det. Uten søkeord gis hele lista.',
    input_schema: {
      type: 'object',
      properties: {
        sok: { type:'string', description:'Ord fra tittelen eller en kategori. Delstreng holder.' }
      },
      required: []
    }
  },
  {
    name: 'les_oppskrift',
    description: 'Henter én oppskrift med ingredienser, mengder, allergener og '
               + 'framgangsmåte. Krever id fra finn_oppskrift eller les_ukeplanen. '
               + 'Mengdene er OPPSKRIFTSMENGDER for det antall porsjoner som står '
               + 'oppgitt, ikke handlemengder.',
    input_schema: {
      type: 'object',
      properties: { id: { type:'string', description:'Oppskriftens id.' } },
      required: ['id']
    }
  },
  {
    name: 'les_ukeplanen',
    description: 'Middagene som er planlagt en uke, dag for dag, med id til hver rett. '
               + 'Uten argument gis inneværende uke.',
    input_schema: {
      type: 'object',
      properties: {
        uke: { type:'string', description:'Uke på formen 2026-W36. Utelat for inneværende uke.' }
      },
      required: []
    }
  },
  {
    name: 'les_husets_handleliste',
    description: 'Varene som står på handlelista, med handletur, mengde, varetype, '
               + 'butikk og om de er huket av som kjøpt. Bruk dette når du står på en '
               + 'ANNEN side enn Handlelista og trenger å vite hva som allerede står '
               + 'der. Hvilken handletur som er åpen på brukerens enhet kan ikke leses '
               + 'utenfra, så alle levende turer gis.',
    input_schema: {
      type: 'object',
      properties: {
        omrade: { type:'string', enum:['mat','annet'],
                  description:'mat = Dagligvarer, annet = Andre varer. Utelat for begge.' }
      },
      required: []
    }
  }
];

/* Kjoerer verktoeyet hvis det er ett av husets. Returnerer {svar}
   eller null. Kastede feil gaar videre til kallstedet, som har
   feilhaandteringa. */
async function husUtfor(navn, arg){
  arg = arg || {};

  if(navn === 'finn_oppskrift'){
    const treff = await finnOppskrifter(arg.sok);
    /* Samme grense og samme grunn som sok_varekatalog i handleliste:
       en full liste uten soekeord spiste hele svarbudsjettet. */
    return { svar: {
      sok: arg.sok || null,
      antall: treff.length,
      treff: treff.slice(0, 40),
      avkortet: treff.length > 40
    }};
  }

  if(navn === 'les_oppskrift'){
    const r = await lesOppskrift(arg.id);
    if(!r) throw new Error('Fant ingen oppskrift med id «' + arg.id + '». '
                         + 'Bruk finn_oppskrift for å få riktig id.');
    return { svar: r };
  }

  if(navn === 'les_ukeplanen'){
    const p = await lesUkeplan(arg.uke);
    if(!p.dager.length){
      return { svar: { uke:p.uke, dager:[], beskjed:'Ingen middager er lagt inn denne uka.' } };
    }
    return { svar: p };
  }

  if(navn === 'les_husets_handleliste'){
    const d = await lesHandleliste(arg.omrade);
    if(!d.handleturer.length){
      return { svar: { handleturer:[], varer:[], beskjed:'Ingen handleturer er i gang.' } };
    }
    /* Taket er det samme som handlelistas egen les_handlelista bruker.
       Naas det, er svaret aa spoerre smalere - ikke aa heve taket. */
    return { svar: {
      handleturer: d.handleturer,
      antall: d.varer.length,
      varer: d.varer.slice(0, 120),
      avkortet: d.varer.length > 120
    }};
  }

  return null;
}

/* Linja som forteller Neam at han kan se seg om. Sidene legger den
   inn i sin egen neamBakgrunn, saa formuleringen staar ett sted. */
const HUS_BAKGRUNN =
    'DU KAN LESE HELE HUSET herfra, uansett hvilken side du står på: '
  + 'finn_oppskrift og les_oppskrift går mot Oppskriftsboka, les_ukeplanen '
  + 'gir middagene som er planlagt, og les_husets_handleliste gir varene som '
  + 'står på handlelista.\n\n'
  + 'MEN DU KAN BARE ENDRE DET SIDA DU STÅR PÅ EIER. Skal noe endres et annet '
  + 'sted, si hvilken app det hører hjemme i - ikke lat som om du gjorde det.\n\n'
  + 'VET DU IKKE, SÅ SI DET. Ikke gjett på hva som står i huset, og ikke finn '
  + 'på en forklaring på hvorfor du ikke ser noe. Har du et verktøy som kan '
  + 'svare, bruk det heller enn å spørre brukeren om å slå det opp selv.';
