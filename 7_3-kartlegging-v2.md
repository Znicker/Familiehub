# 7.3 – kartlegging, revidert

*Verifisert mot filene 27. august 2026, etter økta der avbryt-regelen ble
innført. Erstatter den første kartlegginga. Grunnen til revisjonen: den
opprinnelige var skrevet mot eldre versjoner av minst tre av filene, og
anbefalte som første trekk det stedet som viste seg å være dårligst egnet.*

**Hva som ble gjort:** hver påstand i del 1, 3 og 4 er sjekket ved å hente ut
alle CSS-regler og alle funksjonskropper fra de fem filene og sammenligne dem
maskinelt, med kommentarer og mellomrom strippet bort. Del 2 er ikke rørt –
den venter fortsatt på designgjennomgangen.

---

## 1. Feilene – status

| Funn i første kartlegging | Status |
|---|---|
| `overflow-x:hidden` i handleliste | **Var alt rettet.** Begge linjene (88 og 637) sier `clip`. |
| `esc()` slipper apostrofen i kalender | **Var alt rettet.** Identisk med dashboard, apostrof inkludert. |
| `.btn-primary` bruker feil farge i oppskrifter | **Bortfalt.** Klassen finnes ikke lenger; knappene er døpt om etter betydning. |
| `--lime` og `--blue` er samme verdi | **Står fortsatt.** Begge `#4A7FA8` i oppskrifter og handleliste. Dashboard definerer `--lime:#C8E64B` og bruker den aldri. |

**Rettet i denne økta i stedet:**

- `resetAddForm()` og `saveRecipe()` pekte på `.btn-primary`, en klasse som
  ikke finnes. Alvoret lå ikke i dobbeltkjøring – `saveRecipe` står allerede i
  `appBusy`-sperra – men i at `saveBtn.insertAdjacentElement()` i catch-blokka
  ikke var vaktet. En mislykket lagring kastet en TypeError inne i
  feilhåndteringa, og feilmeldingen nådde aldri skjermen.
- `#confirm-modal` lå bak sju andre modaler. Alle deler `z-index:100`, og de
  som står etter den i dokumentet malte over den. Kom først fram da
  avbryt-regelen begynte å åpne bekreftelser oppå andre modaler.

**Latent, ikke rettet:** kalender bygger Graph-URL-er ved å lime id-er rett
inn i stien – ni steder. Dashboard kjører alle gjennom `enc`
(`encodeURIComponent`) på fjorten steder. Det biter ikke i dag, fordi Graph
sine id-er i praksis er base64url, men det er en forskjell i robusthet der
den ene fila har rett.

---

## 2. Valg som må tas før noe slås sammen

**Uendret fra første kartlegging, og fortsatt ubesvart.** Bakgrunn
(`#ECEFF1` mot `#FAFAFA`), `--ink-soft`, `--line`, `--shadow` og skyggen under
logoen.

Det som er avklart siden: **disse hører til designgjennomgangen, ikke til
7.3.** Bakgrunnsvalget endrer utseendet på fire sider – det er et valg man tar
mens man ser på skjermen, flate for flate, ikke i et regneark før en
refaktorering. Felles `:root` (punkt 4 i den gamle rekkefølgen) kan ikke
bygges før dette er bestemt, ellers bygges den på verdier ingen har valgt.

Tillegg funnet under verifiseringen: dashboard har en tredje bakgrunnsverdi,
`--bg-2:#EDF3F8`, som første kartlegging ikke nevner.

---

## 3. Hva som faktisk kan deles – med tall

### App-skallet – oppskrifter + handleliste ✅ best kandidat

Av de atten reglene som ble påstått felles er **seksten identiske**. De to
som spriker gjør det knapt:

- `.modal-backdrop` har nøyaktig de samme ti deklarasjonene i ulik
  rekkefølge. Ingen reell forskjell.
- `button` er den eneste ekte: oppskrifter setter `font-family:inherit` og
  `cursor:pointer`, handleliste setter `touch-action:manipulation`. Ingen
  overlapp – men begge filene vil ha alle tre. Unionen er svaret.

`.home-hero-icon`, `.home-hero-sub` og `.tab-btn` spriker som beskrevet og
trenger hvert sitt valg. De to siste er typeskala: er faneteksten brødtekst
eller metatekst?

`cloudGet` og `cloudSet` skiller seg bare på parameternavn (`k`/`v` mot
`key`/`value`) og konstantnavn (`SKY_API` mot `API`). Åtte kallsteder.

**Dette er den tryggeste første flyttingen.**

### Filviseren – dashboard + kalender ⚠️ ikke som beskrevet

CSS-siden holder: seksten regler finnes i begge, tretten er identiske. De tre
som spriker gjør det på `#FFFFFF` mot `#fff` og `18px` mot `var(--radius)`.

**JS-siden holder ikke.** Første kartlegging sa fem av elleve identiske. Det
er **tre**: `lukkViser`, `lastNedFraViser` og `esc`. De åtte andre spriker, og
flere på oppførsel:

| Funksjon | Forskjell |
|---|---|
| `aapneVedleggFra` | dashboard koder id-ene med `enc()` og har null-sjekk; kalender har ingen av delene |
| `blobAv` | dashboard tåler tom input (`bytes \|\| ''`), kalender ikke |
| `erPdf` | kalender mangler filtype-sjekken helt |
| `erBilde` | dashboard bruker hjelperen `erFil()`, kalender gjentar odata-sjekken inline |
| `tegnForhaand` | setter **ulikt klassenavn i markupen** – `ved-bilde` mot `vedlegg-bilde` |
| `valgteFiler` | to forskjellige funksjoner, ikke to skrivemåter |
| `aapneViser`, `filTilBase64` | kosmetisk |

To ting følger av dette. For det første er den identiske CSS-en delvis
illusorisk: reglene er like, men `tegnForhaand` gir elementene ulike
klassenavn, så de treffer ikke nødvendigvis de samme reglene. For det andre
er dashboard-versjonen gjennomgående den mer robuste – **sammenslåingen er
ikke en flytting, den er åtte beslutninger, der svaret som regel er «ta
dashboard sin»**, og der kalender får rettet noen svakheter på kjøpet.

Det er fortsatt verdt å gjøre. Det er bare ikke det stedet man starter for å
bevise at fellesfil-oppsettet virker.

### Graph-laget – dashboard + kalender

Bekreftet. `graph(sti, valg)` mot `graph(path, method, payload)`, 29
kallsteder til sammen (17 + 12). `kalenderFarge`, `normEpost`, `htmlTilTekst`
og `dus` er identiske og kan følge med gratis.

### Innloggingen – index, dashboard, kalender

Uendret vurdering: bør vente. Den varige løsningen er å flytte kodevekslingen
til en Pages Function, og da er det den som skal deles.

---

## 4. Det som blokkerer

**Bekreftet i sin helhet.** Alle åtte klassenavnene betyr forskjellige ting i
index og kalender, med verdiene som beskrevet:

| Klasse | index | kalender |
|---|---|---|
| `.brand-icon` | `clamp(120px,17vw,195px)` | fast `56px` |
| `.grid` | én kolonne | `1fr 300px` |
| `.shell` | `max-width:1180px` | fullhøyde flex, `max-width:1960px` |
| `.panel` | `padding:22px`, `border-radius:18px` | `padding:16px`, `var(--radius)` |
| `.panel-title` | `color:var(--ink)` | `color:var(--ink-soft)` |
| `.top` | grid, tre kolonner | flex, sentrert |
| `.brand`, `.panel-head` | ulike oppsett |

Dette er fortsatt den største jobben, og den treffer HTML-en også.

---

## 5. Nytt press mot fellesfiler

Kom til i denne økta, og hører hjemme i regnestykket:

- **Avbryt-regelen er skrevet fire ganger.** `avtrykkAv`, `huskSkjema`,
  `skjemaEndret` og `avbrytSkjema` finnes nå i oppskrifter, handleliste og
  dashboard i nesten identiske versjoner, og kalender har sin egen variant av
  det samme. En endring i regelen må gjøres fire steder.
- **Bekreftelsen ser ikke lik ut.** Oppskrifter bruker sin egen
  `showConfirmModal`, de tre andre bruker nettleserens `confirm()`.
- **Lim-inn-fra-utklippstavle finnes bare i oppskrifter.** Skal den ut på
  kalender og dashboard, blir det samme kode et tredje og fjerde sted.

---

## 6. Rekkefølge og status

*Status per 28. august 2026:*

1. ~~**Designgjennomgangen**~~ – **GJORT** for verdienes del: de fem verdiene
   i del 2 og typeskala-spørsmålene er avgjort og innført i alle fem sidene.
   Gjennomgangen flate for flate (iPad først) står fortsatt igjen som egen økt.
2. ~~**App-skallet ut i egen fil**~~ – **GJORT.** `felles-skall.css` i rota,
   oppskrifter + handleliste, `?v=1`.
3. ~~**Felles `:root` + typeskala**~~ – **GJORT.** `felles-rot.css`, alle fem
   sidene, med omdøpingene beskrevet i designsystemet.
4. **Avbryt-regelen og utklippstavla inn i felles atferdsfil** – regelen er
   innført på alle fem sidene og i designsystemet, men koden ligger fortsatt
   som fire nesten like kopier. Selve fellesfila gjenstår.
5. ~~**Filviseren**~~ – **GJORT.** `felles-filviser.css` + `felles-filviser.js`
   (`?v=2`), dashboard + kalender. PDF-forhåndsvisningen ble samtidig byttet
   fra innebygd iframe til et klikkbart kort – se designsystemet.
6. **Navnekollisjonene i index og kalender.** Den store. GJENSTÅR.
7. ~~**Graph-laget.**~~ – **GJORT.** `felles-graph.js` (`?v=1`), kalender +
   dashboard.

Endringen fra første kartlegging er at filviseren har byttet plass med
app-skallet, og at designgjennomgangen står først i stedet for å ligge ved
siden av.

---

## 7. Kalendermodellen – omgjort 28. august 2026

*Denne delen sa tidligere det motsatte. Den er skrevet om fordi
beslutningen ble reversert samme dag, og en kartlegging som står igjen med
feil konklusjon er nøyaktig det som får en til å gå samme omvei igjen.*

**Modellen er nå:** fem vanlige kalendere – Magne, Nina, Emma, Andrea,
Familien – opprettet på `sys@neam.no` og delt til alle fire kontoene med
**Kan redigere**. Egen standardkalender er privat og deles ikke. Regelen er
én setning: alt delt ligger hos sys, alt privat ligger i din egen kalender.

**Hvorfor dette og ikke delte standardkalendere.** Det oppsettet ble prøvd
og forkastet. En delt standardkalender mellom personlige Microsoft-kontoer
er en *speiling* i mottakerens postkasse. Speilingen bærer beskjeder, ikke
referanser: opprettelse går gjennom, mens sletting og alle
vedleggsoperasjoner krever den fjerne identiteten og feiler med «The item's
remote identity is missing or corrupt». Lese og opprette, ikke slette eller
legge ved – for tungvint til å leve med.

Det er ikke noe å omgå. `/users/{eier}` svarer ErrorInvalidUser fra en
personlig konto, `Calendars.ReadWrite.Shared` er virkningsløst, og «Kan
redigere» er det høyeste delingsnivået outlook.com tilbyr.

**Hvorfor den gamle modellen ikke har problemet:** avtalene bor fysisk i sys
sin postkasse. Sys treffer dem med `/me/...`, og de fire andre går gjennom
kalenderen de er delt til.

**Alternativene som ble vurdert og lagt bort:**

- *Microsoft 365-leietaker med app-only-tilgang.* Løser alt, og gjør Graph-
  abonnementer til push mye tryggere. Koster fem Exchange Online-lisenser,
  rundt 250–300 kr i måneden. Kan kjøpes senere uten at noe av dagens arbeid
  kastes.
- *Egen kalender i KV med ICS-publisering.* Ingen Microsoft-begrensninger,
  men stor omskriving og telefonene blir skrivebeskyttet.
- *«Bare endre egne avtaler».* Virker teknisk, men kjøkken-dashen kjører som
  sys og eier ingenting under det oppsettet. Utelukket.
- *Familiegruppekalenderen «Din familie».* Ikke brukt. Den ligger ikke i sys
  sin postkasse, så den ene mest delte kalenderen ville fulgt andre regler
  enn de fire andre – og dashboards elleve `/me/events/{id}`-kall ville
  feilet akkurat der.

**Gjort i koden 28. august:**

- `Calendars.ReadWrite.Shared` fjernet fra `kalender.html` og `index.html`.
- Kommentaren over `avtaleSti()` skrevet om. Funksjonen står, og er nå
  riktig av en annen grunn enn den ble laget for.
- Kalendermenyen (`#caldropBtn`) skjult for alle andre enn sys, via
  `KAL_ADMIN` og `erKalAdmin`. Grunnen: hver konto ser også sin egen
  standardkalender, bursdager og helligdager i `/me/calendars`, og hvilke
  kalendere som er i spill er en avgjørelse for husstanden, ikke noe hver
  enkelt skal stille inn per enhet.
- Menyen bygget om til en **tilgangsmatrise**, lagret i KV som
  `fh:kal-tilgang`. To rader per kalender – *Tilgang* og *Vis ved start* –
  med husstandens initialer som brytere, og en ALLE/INGEN-knapp per rad.
  Markerte initialer tar kalenderens egen farge, så raden leses som én
  kalender – samme regel som initialstripa. `FARGE_ADMIN` ned til bare sys.
- `fh_cal_valgt` og `fh_cal_strip` fjernet fra localStorage. De lå per
  enhet og var nøkla på kalender-id, og døde derfor hver gang kalenderne
  ble bygget om. Matrisen er nøkla på **navn**, som fargene: en delt
  kalender har én id i sys sin postkasse og en annen i Emmas, så id-er kan
  ikke krysse kontoer.
- Ingenting huskes mellom økter. Oppstartstilstanden kommer fra matrisen;
  det brukeren trykker seg fram til i løpet av økta er sitt eget og
  forsvinner ved neste innlogging. Bevisst: et hurtigvalg som overlever
  økta blir et filter man ikke husker at man satte.
- Tom matrise betyr «ikke satt opp» og gir alle alt, som før. Fra første
  lagring er matrisen fasit, og en kalender som ikke står der finnes ikke.
  Nye kalendere føres inn med full tilgang første gang sys åpner panelet,
  så en nyopprettet kalender aldri blir usynlig i stillhet.

**Dashboard er flyttet over på `avtaleSti()`.** Den brukte `/me/events/{id}`
elleve steder, som virket utelukkende fordi den kjørte som sys – eieren av
alle kalenderne. Fire hjelpere har fått kalenderen inn i signaturen
(`hentVedlegg`, `leggVedFil`, `aapneVedleggFra`, `hentOgTegn`), og
`lagreAvtale` fører nå `malKalId` ved siden av `malId`, siden ny, flyttet og
endret avtale havner i hver sin kalender og vedleggsopplastingen etterpå må
vite hvilken. Dermed kan dashboard kjøre som hvilken som helst konto
kalenderne er delt til.

Verifisert 28. august: sletting fra en konto som ikke eier kalenderen
fungerer på delte *navngitte* kalendere. Det er forskjellen fra delte
standardkalendere, og den bærer hele modellen.

**To ting var utledet av kalenderlista i egen postkasse, og måtte bort.**
Lista er forskjellig for hver konto – sys ser sin standardkalender,
bursdager og abonnementer som ingen andre har – og alt som regnes ut fra
den blir derfor ulikt fra person til person:

- *Reservefargen* lå på `PALETTE[i % lengde]`, der `i` var plassen i lista.
  Samme kalender fikk ulik farge hos ulike folk så lenge ingen hadde valgt
  en eksplisitt. Nå utledes den av navnet (`palettFor`), som er likt
  overalt. Valgte farger i `fh:kal-farger` lå alt på navn og var aldri
  berørt. Endret likt i kalender og dashboard, som har hver sin kopi.
- *Initialene* regnet kollisjoner over hele lista, så sys delte ut to
  bokstaver der kitchen klarte seg med én. `byggInitialer()` teller nå bare
  kalendere med tilgang i matrisen.

**Verdt å vite:**

- `FASTE_FARGER` og fargeoverstyringene i KV er nøkla på *navn*. Så lenge
  kalenderne heter Magne, Nina, Emma, Andrea og Familien, overlever fargene
  enhver ombygging. `INITIAL_PRI` har de samme fem.
- `kalenderValg` og `stripValg` er nøkla på *id*, i localStorage per enhet.
  Nye kalendere = nye id-er = alt på som standard. Gamle nøkler blir
  liggende som død vekt; `fh_cal_valgt` og `fh_cal_strip` er det man tømmer.
- Sletter man en delt kalender hos eieren, blir lenken liggende igjen som en
  tom skygge hos mottakerne. Den kan ikke skrives til, men den kan fjernes,
  og det må gjøres fra hver enkelt konto.

**Egen kjøkkenkonto – besluttet 28. august, ikke bygget.** Kjøkken-iPaden
skal ikke lenger kjøre som sys. Begrunnelsen er admin-eksponering: sys eier
alle kalenderne og er eneste `KAL_ADMIN` og `FARGE_ADMIN`, og en skjerm som
henger permanent innlogget på veggen er en dør uten lås.

Kontoen skal ha *annen*, ikke mindre, funksjonalitet – Homey-styring og
dagsoversikt hører til flaten den henger på. Den skal kunne slette avtaler.

Kontoen heter `kitchen@neam.no` og står utenfor familiegruppa – den gir
bare Family Safety, abonnementsdeling og «Din familie»-kalenderen, og
kjøkkenet trenger ingen av delene. Skriverett på delte kalendere krever
ikke familiemedlemskap; det ble verifisert.

Gjort: `avtaleSti()` i dashboard, `kitchen@neam.no` inn i `HUSSTAND` som
sjette kolonne i matrisen, og `DASH_TILGANG` utvidet til `['kitchen', 'sys']`.
Sys står igjen med vilje – uten den ville en feil på kitchen-kontoen låst
oss ute av veggskjermen uten vei inn. Fjern den når kitchen har stått en
stund.

Initialrekkefølgen i matrisen er N, E, A, M, K, S: husstanden først,
systemkontoene sist.

Gjenstår: Access-bruker for `kitchen@neam.no`.

Rollemodellen på sikt hører til `hub.html`: sys bestemmer hvilke fliser og
funksjoner hver identitet ser, lagret i KV som kalendertilgangen alt er.

## 8. Graph-laget – gjort 28. august 2026

`felles-graph.js`, lastet av kalender og dashboard før sidenes eget skript.

**Signaturen.** De to versjonene hadde ulik form, ikke ulik oppgave:
`graph(sti, valg)` mot `graph(path, method, payload)`. Dashboards form vant –
et valg-objekt tåler at det kommer en tredje ting en dag uten at signaturen
må endres igjen. Fem kallsteder i kalenderen ble skrevet om; resten er
enkle GET-kall som ser like ut i begge former.

**En ekte feil ble rettet på veien.** Dashboard prøvde om igjen på *alle*
metoder ved 429/503/504, ikke bare GET. Et nytt forsøk på en POST som
egentlig gikk gjennom lager avtalen to ganger. Kalenderens sperre
(`kanProveIgjen`) er nå felles.

**Motsatt vei vant dashboard:** et tomt svar som ikke er `ok` kaster nå en
feil med status. Kalenderen returnerte `null` og lot feilen forsvinne i
stillhet.

**Fila inneholder:** `GRAPH`, `TZ`, `enc`, `graph()`, `avtaleSti()`,
`normEpost`, `htmlTilTekst`, `rgbAv`, `dus`, `PALETTE`, `FASTE_FARGER`,
`fargeOverstyring`, `palettFor`, `kalenderFarge`. De fire følgesvennene var
identiske bortsett fra mellomrom; fargefunksjonene ble duplisert samme dag
og er ryddet med det samme.

**Blir liggende i sidene, med vilje:** `hentFarger`/`lagreFarger` (kalender
kan også skrive og har `FARGE_ADMIN`; dashboard bare leser), `dusFast`
(bare kalender), og token-funksjonen. Kalenderens `validToken` er døpt om
til `gyldigToken`, som er navnet dashboard og index alt brukte – fellesfila
kaller det, sidene definerer det.

**Latent, ikke rørt:** `FASTE_FARGER` har nøkkelen `Familie`, men kalenderen
heter `Familien`. Den treffer altså aldri, og faller på `palettFor`. Ett ord
å rette, men det endrer en farge og hører til en design-økt.

---

## 9. Delingsfella – oppdaget 28. august 2026

**En kalender som først deles med visningsrett og senere endres til «Kan
redigere», forblir skrivebeskyttet hos mottakeren.** Rettigheten ser riktig
ut i eierens delingsliste, men mottakerens kobling er låst i den tilstanden
den ble akseptert i.

Dette kostet en økt å finne, fordi symptomet peker feil vei: kalenderen
dukker opp, den vises, alt ser riktig ut i oppsettet – bare skriving feiler.
Det ligner et token- eller scope-problem, og er det ikke.

**Verifisert:** Andrea-kalenderen, delt til kitchen med visning først og
oppgradert etterpå, kunne ikke skrives til. Magne-kalenderen, delt til samme
konto med «Kan redigere» fra start, virket umiddelbart. Samme konto, samme
aliasoppsett, samme delingsnivå i lista.

**Å fjerne og dele på nytt med én gang hjelper ikke** – den ødelagte
koblingen gjenbrukes. Rekkefølgen som virker: fjern kalenderen fra
mottakeren, fjern mottakeren fra delingslista hos eieren, *vent* (rapporter
nevner opptil en time), del så på nytt.

**Regel:** del aldri en kalender med visningsrett til noen som senere skal
kunne redigere. Er du i tvil, gi «Kan redigere» fra start. Nedgradering går
greit; oppgradering gjør det ikke.

**Blindspor underveis, så de ikke gjentas:** manglende
`Calendars.ReadWrite.Shared` (irrelevant – feilsøkingen skjedde i Outlook,
ikke i huben), alias som ikke var registrert på kontoen (de var det),
postkasse som ikke var provisjonert (den var det), og medlemskap i
Microsoft-familiegruppa (ingen dokumentasjon støtter at det kreves).

---

## 10. Navnebyttet – 28. august 2026

«Familie Hub» er ute. Systemet heter **Neam** – husassistenten er stemmen,
roboten er maskotten, og navnet favner alt.

Skrivemåten i koden er `Neam`. Merkelinja (`.brand-sub`) har
`text-transform:uppercase` i CSS, så den viser NEAM av seg selv; det er
ingen grunn til å skrive store bokstaver i kilden.

Sidetitler følger nå **SIDENAVN – Neam**: «Kalender – Neam», «Handleliste –
Neam», «Matlaging – Neam», «Kjøkken dash – Neam». Forsiden er bare «Neam» –
den *er* huben og har ikke noe sidenavn foran seg. Designsystemet er døpt om
til `neam-designsystem-7.md`.

**Identifikatorer er med vilje ikke rørt.** De bærer data, og et prefiks er
et internt håndtak, ikke en merkevare:

- `DB_NAME = 'familiehub'` i handleliste og oppskrifter – omdøping gjør all
  lokal data på hver enhet usynlig
- de elleve `fh_`-nøklene i localStorage – `fh_cal_auth` ville logget ut
  alle på alle enheter
- `fh:`-prefikset i KV – tilgangsmatrise, farger, huskeliste, middagsnotat
- `format:'familiehub-handleliste-1'` og `-varekatalog-1` i eksportfilene –
  importen validerer den ikke, så gevinsten er null

Skal `fh:` bort en dag, er det en migrering, ikke en tekstendring.

**Gjort samtidig, fordi det var gratis:** `merke-familie.png` heter nå
`merke-neam.png`, og formatnavnene i eksportfilene er `neam-handleliste-1`
og `neam-varekatalog-1`. Importen validerer aldri feltet, så gamle
sikkerhetskopier går uendret inn.

### Til 7.5: de to migreringene

Ligger her fordi `hub.html` uansett skal ta over datalaget – gjøres de da,
gjøres de én gang i stedet for to.

**`DB_NAME` fra `familiehub` til `neam`.** IndexedDB per enhet. Et rått
navnebytte gir hver enhet en tom database. Riktig framgangsmåte: åpne den
gamle, kopiere alt over, verifisere, og først deretter slutte å lese fra
den. Overgangskoden må bli stående til alle fem enhetene har vært innom –
regn i måneder, ikke dager.

**`fh:`-prefikset i KV til `neam:`.** Samme jobb på serversiden: liste alle
nøkler, skrive dem på nytt under nytt prefiks, verifisere, slette de gamle.
Enklere enn IndexedDB fordi det finnes ett sted og ikke fem, men det er
fortsatt en migrering med tapsrisiko.

Argumentet for å ikke utsette i det uendelige: datamengden under det gamle
navnet vokser. Argumentet for å vente til 7.5: jobben er den samme uansett
når, og datalaget skal uansett røres da.

---

**Avkreftet – ikke prøv igjen:** delte standardkalendere mellom personlige
kontoer, `/users/{eier}`-stier fra personlig konto, scopet
`Calendars.ReadWrite.Shared`, familiegruppekalenderen som delt flate.
