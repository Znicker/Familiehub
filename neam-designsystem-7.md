# Neam – designsystem

*Hva som er bestemt, og hva som ennå ikke er det. Skrevet under gjennomgangen
før refaktoreringen (7.3), mens beslutningene ble tatt – ikke rekonstruert
etterpå.*

**Slik brukes den:** når noe skal endres i én fil, sjekk om det står her.
Står det her, gjelder det alle fem. Står det ikke her, er det et nytt valg –
og da bør det inn.

Alt under er i dag **kopiert inn i hver enkelt fil**, ikke delt. Fellesfila
kommer i 7.3. Til da er dette dokumentet det eneste som holder filene like.

*Sist oppdatert 27. august 2026, etter økta der knappene ble navngitt etter
betydning i begge appene, tilbakepilene ble erstattet av nettleserhistorikk,
og kartleggingen til 7.3 ble gjort. Kartleggingen ligger som eget dokument –
den er en liste over funn og valg, ikke regler, og hører ikke hjemme her.*

---

## Typeskala

Fem roller. Endres i `:root`, aldri nede i reglene.

| Variabel | Rolle | mobil | iPad | PC |
|---|---|---|---|---|
| `--t-etikett` | små merkelapper, versaler | 11 | 12 | 11 |
| `--t-meta` | sekundær info under en tittel | 13 | 14 | 13 |
| `--t-brod` | vanlig tekst | 15 | 17 | 15 |
| `--t-stor` | kortets hovedtekst | 20 | 22 | 20 |
| `--t-display` | klokke | 46 | 60 | 60 |
| `--t-pil` | piler og lukkekryss | 20 | 22 | 20 |
| `--t-ikon` | større glyffer, værsymbol | 28 | 32 | 28 |

**`--t-rute`** finnes bare i `kalender.html`: 10 / 11 / 10. Tekst inne i
måneds- og ukerutenettet, der cellene har fast høyde. Uten den flyter
innholdet ut av cellene. Bevisst unntak, ikke etterslep.

**Flytt elementer mellom roller, ikke mellom tall.** Er noe for stort, hører
det i en annen rolle. Er rollen riktig men resultatet feil, er det som regel
bredden eller høyden som skal endres, ikke skriften.

**Ett unntak, og bare ett:** tettpakkede kontroller i smale spalter kan gå
under skalaen. I dag gjelder det fanetekstene i oppskriftsvisningen (fem ord
på 375px) og Inkluder/Ekskluder ved søkefeltet. Ingenting annet.

**Skjemafelt står utenfor skalaen.** iOS Safari zoomer inn når man trykker i
et felt under 16px. Derfor er `input, select, textarea` hardkodet til 16px.
Ikke koble dem til `--t-brod` – den er 15 på mobil.

Kjente unntak som fortsatt er under grensa og bør rettes: `.fld
select/textarea` i kalender, `.ing-row input` og `.sec-row input` i
oppskrifter.

**Handleliste er ryddet.** `.field input/select/textarea`, `.type-rad
select` og de to innlimingsfeltene står nå hardkodet på 16px med kommentar
om hvorfor. Kommentaren er der for at ingen skal koble dem til `--t-brod`
senere i god tro.

## Vekt

**600 og 700.** 800 og 900 er fjernet fra alle fem filene.

## Farger

### Flater og tekst

| Variabel | Betydning |
|---|---|
| `--ink` `#2C3E50` | tekst |
| `--ink-soft` `#5A6C7D` | sekundær tekst |
| `--paper` `#FFFFFF` | **kort** – hvit tilhører kortene |
| `--line` `#E4E8EC` | kanter |
| `--boks-mild` `#EDF3F8` | **flate** – grupperingsbokser |
| `--boks-kant` `#DCE6EF` | kant på slike bokser |

Skrivefelt er unntaket fra hvit-regelen: et `input` er hvitt med egen kant
inne i en mild boks. Det er en kontroll, ikke en flate.

### Fem betydninger

| Variabel | Farge | Betyr |
|---|---|---|
| `--handling-ny` | `#4F8F5F` | **skaper noe** – ny oppskrift, nytt tips, legg til rett |
| `--handling-endre` | `#B8873A` | **endrer noe** – rediger, erstatt bilde |
| `--danger` | `#A64D3C` | **sletter noe** |
| `--lime` (aksent) | `#4A7FA8` | **alt annet** – kategori på, sortering, planmodus, og enhver knapp som verken skaper, endrer, sletter eller avbryter |
| `--handling-tvers` | `#7A5EA8` | **går på tvers av apper** – send til handlelista |

**Blå er ikke en betydning, men fravær av en.** Den ble tidligere beskrevet
som «valgt / navigerer». Det holdt ikke: knapper som `Last ned`, `Slå
sammen` og `Ferdig` gjør ingen av delene, men skal fortsatt være blå. Regelen
er derfor negativ – blått er det som blir igjen når de fire andre ikke passer.
Det gjør den lett å bruke og betyr at en ny farge må begrunnes mot de fire,
ikke mot blå.

De fire første gjør noe **her**. Lilla flytter noe **dit** – den er en annen
kategori, ikke en femte handlingstype. Det er begrunnelsen for at den fikk
være en femte farge; kommer det en sjette, må den ha en like klar
begrunnelse.

`--handling-endre` må holde avstand til `--danger`. En rødoransje ville sett
lik ut ved siden av Slett i samme meny; oker gjør ikke det.

**Trykktilstand har egne verdier.** `--handling-ny-moerk`,
`--handling-endre-moerk`, `--handling-tvers-moerk`, `--lime-dark` og
`--danger-moerk` `#8E4033`. Den siste er ny, og verdien er hentet fra
`.rediger-topp-knapp.avbryt` der den alt sto hardkodet. Uten den arvet
sletteknappene trykktilstanden fra den grønne klassen og **ble grønne i det
øyeblikket man trykte på dem**.

**Formregelen som følger fargen:** fylt flate betyr at knappen skaper noe.
Tekst uten flate betyr at den tar deg et sted. Da trengs ingen skillestrek
mellom navigasjonsvalg og en opprett-knapp – flaten skiller selv.

**Kjent avvik fra formregelen:** `.store-header` og `.category-header` i
handleliste er fylte flater uten å skape noe. De er overskriftsbånd, ikke
knapper – samme mønster som `.ing-type-head` i oppskrifter. Beholdt bevisst
til 7.3 avgjør om overskriftsbånd skal ha en egen form som ikke låner
knappens.

**Ord slår symboler når det er plass.** Hake og kryss, blyant og
søppelbøtte, to like utklippstavler – alle er byttet mot ord der bredden
tillater det. Der radene er for tette (ingredienslista) beholdes symbolet,
men det får fargen som forklarer det.

### Knappeklasser

Klassene heter det de **betyr**, ikke det de er store som. Dette er avgjort og
gjennomført i oppskrifter og handleliste.

| Klasse | Farge | Når |
|---|---|---|
| `.btn-ny` | grønn | lagrer eller legger til |
| `.btn-endre` | oker | endrer noe som finnes |
| `.btn-slett` | rød | sletter |
| `.btn-ghost` | nøytral | avbryter |
| `.btn-tvers` | lilla | går på tvers av apper |
| `.btn-blaa` | blå | alt annet |

**Formen ligger for seg.** `.btn-blokk` er full bredde, `.btn-pille` er den
lave avrundede. En knapp skal kunne skifte betydning uten å skifte størrelse.

### Avbryt-regelen

*Avgjort og gjennomført på alle fem sidene 27. august 2026.*

**Avbryt er alltid nøytral.** Rødt betyr slett, og en farge kan ikke bety to
ting i samme app. Nøytral er `--paper` med `--line`-ramme og `--ink`-tekst –
det er allerede behandlingen dashboard (`.hu-avbryt`) og kalender (`.btn`)
bruker, så regelen er de andre sidenes praksis skrevet ned.

**Advarselen ligger i en bekreftelse, ikke i fargen.** Det var faren som
gjorde at Avbryt ble rød i redigeringsmodus i oppskrifter: den forkastet alt
uten å spørre, og fargen var den eneste advarselen som fantes. Bekreftelsen
overtar den jobben, og da kan fargen si det den skal.

**Bekreftelsen kommer bare når det finnes noe å miste.** To ledd:

1. Ødelegger knappen noe som er *lagt inn* – tekst, tall eller filer – og som
   ikke finnes lagret noe annet sted?
2. Er det faktisk endret siden skjemaet ble åpnet?

Valg i nedtrekk og avkryssinger teller ikke. De koster ingenting å gjøre om,
og å spørre om dem er å bruke opp folks tålmodighet på noe som ikke står på
spill. Er ingenting endret, går Avbryt rett ut uten dialog. **Det er hele
poenget: en dialog man får hver gang, er en dialog man slutter å lese.**

Ledd 2 er samme prinsipp som «Avbryt må angre alt» under Redigeringsmodus –
ta vare på utgangspunktet når skjemaet åpnes, sammenlign når man går ut.

**Slik er den bygget.** Hver side har `huskSkjema(id)` ved åpning og
`avbrytSkjema(id, lukk)` på knappen; `lukk` er sidens egen lukkefunksjon, så
oppryddingen ligger fortsatt ett sted. I oppskrifter er avtrykket hektet på
`openModal()`, så nye modaler er dekket uten å gjøre noe. Lagre- og
slettestiene kaller lukkefunksjonen direkte og spør aldri.

**Det som ikke er avgjort:** oppskrifter bruker sin egen `showConfirmModal`,
de tre andre sidene bruker nettleserens `confirm()`. Begge oppfyller regelen,
men de ser ikke like ut. Å samle dem i én komponent hører til 7.3, ikke til
regelen.

## Felles filer

### `felles-skall.css`

*Første flytting i 7.3, gjennomført 27. august 2026. Gjelder oppskrifter og
handleliste.*

Sidemønsteret de to deler ligger nå i én fil: topplinje, faner, visninger,
modalbakgrunn, kort, skjemafelt, hero og tom tilstand – 31 regler. De sto
allerede tegn for tegn like i begge filene; dette er en flytting, ikke en
omskriving.

**Lastes før sidens egen `<style>.** Da kan en side overstyre en delt regel
ved å skrive den om lokalt, og alle `@media`-blokker i sidene virker som før
siden de kommer etter.

**Fire spørsmål måtte avgjøres for å få reglene like:**

| | Valg | Hvorfor |
|---|---|---|
| `.tab-btn` | `--t-meta` | Faneteksten er alt versal, fet og spatiert. På brødtekststørrelse konkurrerer den med innholdet den navigerer i. Oppskrifter lå på `--t-brod`. |
| `.home-hero-sub` | `--t-meta` | Samme vurdering. |
| `.field input/textarea/select` | `16px` | Et gulv, ikke en smakssak: under 16px zoomer iOS inn på feltet ved fokus. Oppskrifter lå på 17px. |
| `button` | unionen | Oppskrifter satte `font-family` og `cursor`, handleliste `touch-action`. Begge vil ha alle tre. |

**Blir liggende i sidene, med vilje:** fargen på `.topbar h1` (hvit i
oppskrifter, mørk i handleliste), `.field-hint`, `.field-note` og
`.topbar-home-actions` som bare handleliste har, og `#confirm-modal`s
`z-index` som bare oppskrifter trenger.

**`?v=1` på lenka.** Cloudflare kan servere fila fra cache, og en iPad som
sitter igjen med gammel versjon er vanskelig å feilsøke. Bump tallet i begge
filene når `felles-skall.css` endres.

### Hvor mange fellesfiler, og hvem deler hva

**`felles-skall.css` skal ikke vokse til fem sider.** Navnet inviterer til
det, så det er verdt å slå fast: de tre andre sidene bruker **null** av de 36
selektorene i fila. Ikke én. Sjekket 27. august 2026.

Det er ikke drift som skal ryddes opp – det er tre forskjellige slags sider:

| Side | Hva den er | Egne strukturklasser |
|---|---|---|
| oppskrifter, handleliste | apper med topplinje, faner, visninger, modaler | `.topbar`, `.tabs`, `.view`, `.card-panel`, `.field` |
| index | oppstartsflate, rutenett av app-fliser | `.app`, `.app-icon`, `.app-badge`, `.shell`, `.top` |
| dashboard | informasjonsskjerm | `.kort`, `.kort-tittel`, `.hu-felt`, `.av-felt` |
| kalender | rutenett med paneler | `.panel`, `.fld`, `.fab`, `.boble-notat` |

Index, dashboard og kalender har hver sin struktur fordi de gjør hver sin
jobb. Å tvinge dem inn i app-skallet ville vært å finne på et fellesskap som
ikke finnes.

**Delingen går derfor på tre nivåer, ikke ett:**

1. **`:root` – alle fem.** Palett og typeskala. Den henger ikke på at sidene
   deler struktur, bare at de deler farger og størrelser. Neste flytting.
2. **App-skallet – oppskrifter + handleliste.** Gjort.
3. **Filviseren – dashboard + kalender.** Deres delte komponent: seksten
   CSS-regler, tretten identiske. Ikke skallet, men like reelt.

**Én ekte dublett som ikke passer i noen av de tre:** skjemaboksen finnes tre
ganger med tre navn – `.field` i skallet, `.av-felt`/`.hu-felt` i dashboard,
`.fld` i kalender. De gjør samme jobb. Å slå dem sammen betyr å døpe om
klasser i HTML-en, altså samme slags jobb som navnekollisjonene mellom index
og kalender, og hører hjemme i den økta – ikke i skallet.

### `felles-rot.css`

*Andre flytting i 7.3, gjennomført 27. august 2026. Gjelder alle fem sidene.*

Palett og typeskala ligger nå i én fil, lastet først – før
`felles-skall.css` og før sidens egen `<style>`. Typeskalaen sto allerede
identisk i alle fem, på alle tre bruddpunktene; den var en ren flytting.

**Navnesakene fra 7.3 er gjennomført her, siden alle fem filene måtte endres
samtidig:**

| Gammelt | Nytt | Hvor |
|---|---|---|
| `--lime`, `--blue`, `--blaa` | `--aksent` | de tre var samme verdi `#4A7FA8` under tre navn, to av dem side om side i samme stilark |
| `--lime-dark` | `--aksent-moerk` | |
| `--blue-light` | `--aksent-lys` | betyr «valgt» – ikke slå sammen med `--boks-mild` |
| `--gronn`, `--gronn-mork` | `--handling-ny`, `--handling-ny-moerk` | dashboard |
| `--oransje`, `--oransje-mork` | `--handling-endre`, `--handling-endre-moerk` | dashboard |
| `--rod` | `--danger` | dashboard |
| dashboards `--bg-2` `#EDF3F8` | `--boks-mild` | begge bruksstedene var grupperingsbokser – det er den betydningen, og det er verdien de fire andre alt hadde |

Den ubrukte limegrønnen `#C8E64B` er ute. Den lå igjen i dashboard under
navnet `--lime` og ble aldri brukt.

**Blir liggende i sidene, med vilje** – de brukes bare ett sted hver:
`--shadow-lift` (index), `--t-dagsnavn` (dashboard), `--grid`, `--idag` og
`--t-rute` (kalender). Sistnevnte følger de samme bruddpunktene som
typeskalaen og har egne små `@media`-linjer i sida.

Fire variabler settes fra JavaScript og hører ikke hjemme i noen stilfil:
`--dlg-topp`/`--dlg-hoyde` (dashboard), `--peker`/`--hale` (kalender) og
`--topbar-h` (oppskrifter).

### `felles-filviser.css` + `felles-filviser.js`

*Tredje flytting i 7.3, gjennomført 27. august 2026. Gjelder dashboard og
kalender – de to sidene som henter vedlegg fra Graph.*

Første JS-flytting, og den første som er en **sammenslåing og ikke bare en
flytting**. På CSS-siden var reglene så godt som like; på JS-siden var bare
tre av elleve funksjoner identiske. Dashboardversjonen vant nesten overalt,
fordi den var den mer robuste. Det som følger med kalenderen er derfor
rettelser, ikke bare omplassering:

- `erPdf` manglet filtype-sjekken helt, og kunne ta en vedlagt avtale med
  «.pdf» i navnet for en PDF.
- `blobAv` kastet på et vedlegg uten innhold; `atob(bytes || '')` gjør ikke det.
- `filTilBase64` sendte `undefined` videre på en tom fil.

**Én ting går motsatt vei.** Dashboards `erFil` krevde at `@odata.type`
finnes; kalenderens sjekk tålte at feltet manglet. Den delte versjonen tar
kalenderens toleranse – mangler typen, antar vi filvedlegg. Det strengeste
valget ville skjult vedlegg der Graph utelater feltet, og det er en verre
feil enn den den forhindrer.

**Klassenavnene på forhåndsvisningen er kalenderens:** `.vedlegg-bilde`,
`.vedlegg-pdf`, `.vedlegg-aapne`. Dashboard skrev `ved-*`. Det fulle ordet
vant fordi det matcher `vedleggNye` og `hentVedlegg` i koden. Dashboards
`.ved-rad` og `.ved-fjern` er noe annet – vedleggsraden i skjemaet – og blir
liggende i sida.

**PDF-forhåndsvisningen er et kort, ikke en innebygd visning** (`?v=2`,
28. august 2026): en `<iframe>` med PDF er sin egen rullebeholder inne i et
panel som også ruller, og iOS overstyrer høyden på PDF-innhold uansett.
Kortet (`.vedlegg-pdf-kort`, rødt PDF-merke + filnavn) åpner filviseren, som
fyller skjermen. Bilder beholder ekte forhåndsvisning – `<img>` skalerer som
den skal.

**Én ekte fargeforskjell dukket opp** da palettnavnene ble slått sammen:
`.filviser-knapp` sto på `--boks-mild` i dashboard og `--bg-2` i kalender.
Før omdøpingen så det ut som to navn på én farge; det var det ikke.
`--boks-mild` vant – en kantet pille på et hvitt kort trenger en flate å stå
på.

**Blir liggende i sidene, med vilje:** `aapneVedleggFra()`, som kaller
`graph()` – de to signaturene er ikke slått sammen ennå – og viser feil på
hver sin måte, og `valgteFiler()`, som er to forskjellige funksjoner mot hver
sin vedleggsliste, ikke to skrivemåter av én.

Det var sammenblandingen av form og farge som gjorde skaden: `.btn-primary`
bar både «hovedknapp i skjemaet» og en farge, og siden hver fil hadde valgt
sin egen farge til den rollen, betydde **samme klassenavn grønn i handleliste
og blå i oppskrifter**. `.btn-ghost` var derimot identisk i begge. Hadde
filene blitt slått sammen slik, ville den ene siden arvet den andres
knappefarger uten at noe så galt ut i diffen.

**Ingen inline `background` på knapper.** Sju sletteknapper var skrevet som
`class="btn btn-primary" style="background:var(--danger)"` – de så ut som de
skapte noe, og så ble flaten overstyrt. Finnes ikke klassen du trenger, lag
den; ikke overstyr en som betyr noe annet.

**`.btn-success` er avviklet.** Navnet sa «vellykket» mens fargen sa «endre».

### Navn som skal ryddes i 7.3

**`--lime` heter feil** – den er dempet skifer nå. Døp den om til `--aksent`,
men først når alle fem filene endres samtidig.

**`--lime` i Kjøkken dash er noe helt annet:** `#C8E64B`, og **den brukes
ikke noe sted**. Fjern den ubrukte når filene slås sammen.

**Kjøkken dash har egne navn på handlingsfargene.** Verdiene er nå de samme
som i de fire andre filene, men de heter `--gronn`, `--oransje` og `--rod` i
stedet for `--handling-ny`, `--handling-endre` og `--danger`. Fila har også
`--gronn-mork` og `--oransje-mork` til trykktilstand, som de andre har uten
egne variabler. Døp om til fellesnavnene i 7.3 – ikke før, siden alle fem
filene må endres samtidig.

`--blue-light` `#E3ECF4` betyr «valgt» (sortering, suksess). Den må ikke slås
sammen med `--boks-mild`.

Bakgrunn på alle sider: `--side-bakgrunn`
= `linear-gradient(160deg,#F5F5F5 0%,#ECEFF1 100%)`,
`background-attachment:fixed`. Kort: `border-radius:18px`, skygge
`0 2px 14px rgba(0,0,0,.06)`.

**Gjennomført på alle fem filene 27. august 2026.** Fire av dem lå på
`#F5F5F5→#FAFAFA` og er flyttet hit. Kortene er hvite, og mot `#FAFAFA` hadde
de knapt noen flate å ligge på – kanten var det eneste som skilte dem. Det
merkes mest på kjøkken-iPaden, som leses på avstand.

**Bakgrunnen har fått en egen variabel, og det var nødvendig.** De fire filene
bygde gradienten av `--bg-1` og `--bg-2`, men de to er *flatetoner* med egne
jobber: topplinje, søkefelt og knappeflater i oppskrifter og handleliste, og
tretten steder i kalenderen – rutenett, ukehode, segmentknapper, celler
utenfor måneden. Hadde `--bg-2` blitt satt til `#ECEFF1`, ville alle de
flatene skiftet farge med på kjøpet. `--side-bakgrunn` er bakgrunnen og
ingenting annet, og er den som skal løftes inn i felles `:root` i 7.3.

**`--ink-soft` er endret fra `#7A8899` til `#5A6C7D`** – altså verdien de fire
andre filene alt hadde, ikke dashboardets. Doc'en sa tidligere `#7A8899`.
Grunnen til omgjøringen er kontrast: `#7A8899` gir 3,46 mot bakgrunnen, og
3,13 mot dashboardets egen flate. WCAG-grensen for vanlig tekst er 4,5.
`#5A6C7D` gir 5,19. Metateksten er de små linjene – mengder, kategorier, «sist
endret av» – på 11 og 13 px, på en skjerm som henger på veggen. Det er
nøyaktig der lav kontrast biter.

**`--line` er `#E4E8EC` i alle fem.** Index lå på `rgba(44,62,80,.10)`.

**`--shadow` er `0 2px 14px rgba(0,0,0,.06)` i alle fem.** Index og kalender lå
på den hardere `0 2px 10px rgba(0,0,0,.08)`; dashboard hadde ingen `--shadow`
i det hele tatt og har fått den.

**Skyggen under logoen er `rgba(44,62,80,.18)`.** Oppskrifter lå på ren svart
`rgba(0,0,0,.28)`. Den nye er tonet med `--ink`, som resten av paletten.

**Handleliste er migrert hit.** Fila lå igjen på den gamle
material-paletten og hadde en egen femlags vignettbakgrunn med mørke
ellipser og prikktekstur – ingen andre filer hadde noe slikt. Den er nå på
felles `:root` og felles gradient, og knappene er fordelt på de fem
betydningene: grønt på Legg til og Lagre, oker på flytte- og
bekreftelsesknapper, og en ny klasse `.btn-tvers` i lilla på Les inn, Last
ned katalogen, Slå sammen og import-knappen. Det er fire knapper som alle
flytter data mellom apper – nøyaktig det lilla betyr.

## Skjemaer og tastatur

Dette kostet en hel økt og flere feilgjetninger. Reglene under er dyrekjøpte.

**`vh` krymper ikke når tastaturet kommer opp.** iOS later som vinduet er
like høyt, selv om halve skjermen er dekket. Alt som regner høyde i `vh` for
å holde seg over tastaturet, regner derfor på en høyde som ikke finnes.
Bruk `visualViewport.height` og `visualViewport.offsetTop`, og oppdater på
`resize` og `scroll` på den. `vh` beholdes bare som reserve for nettlesere
uten den.

**Knapperaden skal ligge utenfor rullefeltet.** Et skjema som ruller
innvendig tar knappene med seg ut av syne. Kortet er `flex-direction:column`
med `overflow:hidden`; overskrift og knapperad er `flex-shrink:0`, og bare
selve skjemaet ruller. Da kan innholdet bli så høyt det vil uten at Lagre
forsvinner.

**Høyde løses med kolonner, ikke med posisjon.** Seks felt under hverandre
blir høyt uansett hvor høyt oppe skjemaet starter. Bredere kort og to eller
tre kolonner er det som faktisk får hele skjemaet over tastaturet. Kjøkken
dash bruker `grid-template-areas`, handleliste et enklere rutenett som går
fra én til to til tre kolonner.

**iOS tegner `date`, `time` og `select` med sin egen drakt.** De får egen
høyde, egen minstebredde og midtstilt tekst – datofeltet stakk ut over
nabokolonnen, kalendervalget var 8px lavere enn tekstfeltet ved siden av, og
klokkeslettene sto midtstilt mens alt annet sto til venstre. Chrome sin
iPad-simulator tegner dem som vanlige bokser, så feilen synes ikke der. Slå
av drakta med `-webkit-appearance:none`, sett høyde og `text-align:left`
selv – og tegn nedtrekkspila inn igjen på `select`, for den forsvinner
sammen med drakta.

**En filvelger kan ikke være `display:none`.** Safari nekter å åpne den
programmatisk. Legg den utenfor skjermen i stedet.

**`transform` på en forelder gjør `position:fixed` relativ til den.** Å bryte
et element ut av en smal spalte med `margin-left:50%; transform:translateX(-50%)`
ødelegger derfor alt som er fastposisjonert inni. Bruk en klasse på `body` og
sett bredden på `main` i stedet.

**Bakteppet lukker ikke skjemaet.** Et halvskrevet notat skal ikke ryke av et
bomtrykk. Veien ut er Avbryt, krysset eller Escape.

**Foto duger ikke til feilsøking av layout.** Fire runder gikk med på å gjette
ut fra bilder tatt på skrå av en skjerm i landskap. Be om skjermbilde – da er
det piksler å måle i stedet for perspektiv.

## Modus

- **mobil** under 700px – kjapt, på farten
- **iPad** 700–1300px – display og betjening, leses på avstand
- **PC** over 1300px – oversikt, tåler tett informasjon

**Landskapsbetingelsen** skrives alltid slik:

```
@media (min-width:820px) and (min-height:600px) and (orientation:landscape)
```

Høydekravet er ikke pynt – uten det treffer regelen telefon i landskap. For
lave skjermer generelt brukes `@media(max-height:600px)`, ikke `orientation`.
I JavaScript finnes betingelsen som konstanten `LANDSKAP` – gjenbruk den.

## Primærenhet per side

Alt skal **virke** overalt. Bare primærenheten skal være **forseggjort**.

| Side | Primærenhet |
|---|---|
| Kjøkken dash | kjøkken-iPad |
| oppskrifter | iPad ved benken, PC ved innlegging |
| handleliste | mobil |
| kalender | mobil og PC |
| index | alle |

PC er utviklingsflate, ikke bruksflate.

## Kjøkken dash

Fila het `dashboard.html` og gjør det fortsatt – bare det synlige navnet er
endret, så snarveier og bokmerker holder.

**Merket øverst:** logo, sidenavnet stort, `NEAM` som liten linje under.
Navnet på den innloggede står ikke der – sidenavnet forteller hvem dashet
tilhører når hver får sitt. Logoen er den samme som flisen på forsiden.
Målet er at hver side bærer sitt eget merke, og at merket er identisk med
flisen man trykker på for å komme dit. Ikke gjennomført på de andre fire
ennå.

**Døgnet skifter klokka 20.** Etter det viser skjermen morgendagen, og
etiketten sier «I morgen» – ikke «I dag», som ville vært en løgn. Alt som
bare gjelder den virkelige i dag (pågår, forbi, nå-været) sjekker en egen
`viserIdag()`, ikke `dagOffset`. Skjermen står på hele døgnet, så den må
oppdage skiftet selv: klokka sammenligner dagsbasisen mot forrige tikk og
tegner om, både kl. 20 og ved midnatt.

Dette ble tidligere skrevet opp som «bør utløses av hvilen, ikke av klokka».
Det ble klokka. Hvilen nullstilles av hvert trykk, og en skjerm noen står
foran og lager middag ville da aldri skiftet.

**Passerte avtaler ruller opp av seg selv**, slik at neste avtale ligger
øverst. De blir stående – man kommer til dem ved å rulle tilbake. Skjer bare
når man ser på i dag.

**Ingen bunnrad.** «Sist oppdatert», Oppdater og Logg ut er borte. Skjermen
oppdaterer seg selv hvert femte minutt, når den kommer fram igjen, og ved
døgnskifte. En kjøkkenskjerm har ingen som logger ut.

**Klokkeslettene er svarte.** Den pågående avtalen hadde blå tid, resten
svart – «noen er blå og noen er svarte» er ikke en regel man leser av en
skjerm på avstand.

**Merknader og Denne uken.** Dagens merknader står hele dagen uten å falme.
Ukemerknadene har ingen dato, bare en ukedag («innen ons»), og hukes av med
en boks som ligger **utenfor** den fargede raden, til høyre. Avhukede synker
til bunnen og blir stående ut uken. Under panseret lagres fortsatt en dato,
beregnet fra ukedagen – da er uke- og sorteringslogikken urørt.

## Redigeringsmodus

Mønsteret fra oppskriftssiden, ment å gjenbrukes.

**Én knapp slår på modusen.** Mens den står på: okerskjær på alt som kan
endres, faner med redigerbart innhold får samme duse flate, og det som ikke
kan endres her gråes ut.

**Veiene ut ligger samme sted som knappen som slo den på** – Lagre i grønt
over Avbryt i nøytralt. Ingen dupliserte knapper lenger nede på siden.
(Sto tidligere som «Avbryt i rødt». Det motsa fargetabellen, og det er
fargetabellen som gjelder – se Avbryt-regelen.)

**Avbryt må angre alt.** Ikke bare det ene feltet man ser. Løsningen er å ta
vare på utgangspunktet når modusen slås på, og skrive det tilbake hvis noe
faktisk ble endret. Uten det betyr Avbryt «angre det siste», og da er den
ikke til å stole på.

**Poster åpnes én om gangen.** Tips, kommentarer og vurderinger står i ro
med Endre og Slett til høyre – ikke ti åpne felt samtidig.

**Rekkefølge flyttes med piler og et skrivbart nummer**, ikke med draing.
Draing slåss mot rulling på berøringsskjerm, og nettleseren avbryter draget
når den tror du blar. Piler for nabobytte, tall for lange hopp.

**Sletting hører nederst på siden**, ikke i samme hjørne som Lagre.

## Mønstre

**Korttitler** er svarte, `--t-meta`, versaler, `letter-spacing:.1em`.

**Sorteringsknappen** er `.sorter-flyt` / `.sorter-knapp` – fast nede til
høyre, 48px, samme i alle skjermformater. Flytende knapper i samme hjørne
skal ha samme diameter; sideluft legges først til når en knapp folder ut
tekst.

**To trykk på berøringsskjerm:** første trykk viser navnet, andre utfører.
Navnet trekker seg inn ved rulling, ved trykk et annet sted, og etter fire
sekunder. Brukes bare der navnet ikke får plass.

**Autofullfør erstatter nedtrekkslister.** Mønsteret fra handleliste, ment
å gjenbrukes: et vanlig `input` i en `.ac-wrap`, med en `.ac-drop` under som
filtrerer mens man skriver. `acBind(felt, hentListe, valg)` binder det hele.

To varianter, og forskjellen er prinsipiell. **Lukket liste** (`closed`) lar
deg filtrere, men ikke finne på noe nytt – brukes der verdien betyr noe for
resten av systemet: varetype og hvem som la den til, fordi begge grupperer og
sorterer. **Åpen liste** gir ekstra valg nederst når det du skrev ikke finnes:
legg til denne gangen (`canAddOnce`), eller legg til permanent (`canAddPerm`).

**Enheten er flyttet fra lukket til åpen.** Den ble aldri brukt til å gruppere
noe – den er bare tekst som havner bak mengden. En «klype» eller en «neve» er
noe brukeren vet bedre enn lista, og lista i koden røres ikke: enheten lagres
på varen som en engangsverdi. Butikkfeltet er fortsatt det eneste med
permanent lagring.

**Mengdefeltet er tekst, ikke tall.** `type="number"` avviser alt som ikke er
siffer, og «1/2», «ca 2» eller desimalkomma på norsk tastatur er dermed
umulig. Mengden lagres og vises som ren tekst overalt – ingenting regner på
den – så feltet er nå `type="text"`. Prisen er at det vanlige tastaturet
kommer opp i stedet for talltastaturet.

Rader i nedtrekket kan ha bilde. Butikkfeltet viser butikklogo, varefeltet
viser produktbilde. Det er det samme mønsteret, ikke to.

**Ett skjema for oppretting og endring.** Handleliste hadde to: en side for
ny vare og en modal for rediger, med hvert sitt sett felt (`f-` og `e-`).
Modalen er slettet, og `openEdit()` fyller ut det samme skjemaet.
`saveItem()` greiner på om det ligger en id i `byttId`. Poenget er ikke å
spare linjer, men at et felt som legges til, fjernes eller flyttes bare kan
gjøres ett sted – to skjemaer glir fra hverandre uten at noen merker det før
det ene mangler noe.

Det som **ikke** skal kunne endres i etterkant, skjules i stedet for å stå
dødt: fanene Dagligvare/Andre varer er borte når man endrer, fordi lagringen
ikke flytter en vare mellom listene. Et valg som ikke virker er verre enn
ingen valg.

**Sletting ligger bak Endre, ikke i lista.** En sletteknapp på hver rad er
for lett å treffe med tommelen. Merknadene på Kjøkken dash har derfor bare én
oransje endre-knapp per rad; Slett står i rødt nederst til venstre i skjemaet
som åpnes, med bekreftelse på overskriften.

**En pil er ikke en knapp.** Symboler som ikke gjør noe ved trykk skal ikke
se ut som knapper. En uttoning sier «det er mer her».

**Vindretning tegnes som pil, ikke som «NØ».** Meteorologiske grader sier hvor
vinden kommer *fra*; pila viser hvor den blåser *mot* – grader pluss 180.

**Kartnål betyr «et sted». Sikteikon betyr «min posisjon nå».**

**Orddeling:** `lang="nb"`, ikke `"no"`. «no» er en paraplykode uten
orddelingsordbok. Sammensatte ord får `&shy;` på fugen og `hyphens:manual` –
automatisk deling gjetter feil («KVITTERIN-GER»).

**Tall skal ha grunnlaget sitt med seg.** Per 100 g og per porsjon er samme
felt med to betydninger. Regn om bare når mengden er oppgitt i vekt – aldri
gjett vekten av «2 stk løk».

**Mengde og enhet er to felt, ikke ett.** En vare har `amt` og `unit`, begge
tekst. Den gamle `qty` var fritekst og finnes fortsatt, men bare som avledet
visningstekst for import av gamle lister. Skriv aldri til `qty` som kilde.
Standardenhet er «stk».

**Navn som står to steder må skrives to steder.** Oppskriftens tittel ligger
både på oppskrifta og i indeksen forsiden leser.

## Navigasjon og historikk

**Ingen tilbakepiler.** På nettbrett og telefon er sveip fra kanten
tilstrekkelig; på PC har nettleseren egne navigasjonsknapper. Piler i skjermen
er en tredje vei som må vedlikeholdes og plasseres, og som ikke sier noe mer
enn bevegelsen allerede gjør. `.topbar-back` og `.back-fab` er fjernet.

**Men sveipen må ha noe å gripe i.** Visningene byttes med `showView()` uten
sidelasting. Uten historikkoppføringer finnes det ingenting å gå tilbake til,
og sveipen forlater hele appen i stedet for å gå ett steg. Mønsteret:

- `history.replaceState({fh:true, visning:HJEM}, '')` når sida lastes
- `history.pushState` i `showView()`, men ikke når visningen alt ligger øverst
- en `popstate`-lytter som kaller appens egen navigasjonsfunksjon
- et flagg som er sant mens `popstate` behandles, så tilbakesteget ikke selv
  legger igjen en ny oppføring

**Hjemvisningen står som `class="view active"` i markupen og går aldri gjennom
`showView()`.** Derfor må den første oppføringen settes eksplisitt ved lasting.
Overlates det til første `showView()`-kall, blir det en *under*visning som
kaller `replaceState` – den legger seg da **over** forsiden i stedet for etter
den, og ett tilbakesteg bærer rett ut av appen. Dette var ikke åpenbart før det
ble testet på enhet.

**Sidene er ekte sidelastinger.** Når visningene først ligger i historikken,
tar den samme sveipen deg videre ut til appen du kom fra. Navigasjon på tvers
krever derfor ingen egen mekanisme.

**`replaceState` med `{}` sletter tilstanden.** Dyplenken i oppskrifter ryddet
`?rett=` ut av adressen og tømte samtidig `fh`-merket. Send `history.state`
inn igjen når det bare er adressen som skal endres.

**Kalender har ikke dette ennå.** Fire visninger og et sidepanel bytter uten
historikk. Sveipen oppfører seg derfor ulikt i de tre appene – verre enn om
ingen hadde hatt det.

## Merkelapper

Hver ferdige app har sin egen **NEAM-merkelapp**: en rund klistremerke-figur
med et bånd nederst der appens navn står. `merke-familie`, `merke-kjokken-dash`,
`merke-matlaging`, `merke-handleliste`, `merke-kalender`. Roboten går igjen i
alle og binder dem sammen.

**Navnet står i bildet, altså ikke ved siden av det.** Der en merkelapp
brukes, er tekstetiketten fjernet – på flisene i index, i topplinja på index,
og i hero-en på både handleliste og oppskrifter. Der sto «Handleliste / NEAM»
og «Neam / Matlaging» under merket; begge er borte, og merket er
utvidet fra 80px til 125px slik at det fyller høyden de to linjene tok.
Hero-en er like høy som før. Navnet på innlogget bruker står igjen under. Navnet ligger i `alt` på bildet og i
`aria-label` på lenka, så skjermlesere og lange trykk finner det fortsatt.

**Merkelappen står fritt.** Ingen sirkel, ingen luft, ingen skygge rundt.
Figuren har eget omriss og egen bunn. Dette er mønsteret i `.merke-ikon`
(dashboard) og `.brand-icon` (kalender, index).

**Ikke klipp den i en sirkel.** `border-radius:50%` med `overflow:hidden`
kapper endene av båndet nederst. Kjøkken dash-flisa i index hadde dette uten
at noen la merke til det, fordi kappingen var symmetrisk. Merkelappene har
gjennomsiktige hjørner og trenger ikke klipp.

**Filene er beskåret tett.** Bildets bredde *er* sirkelens diameter, og
sirkelen starter øverst i bildet. Båndet nederst gjør fila 3–8 % høyere enn
bred. Der merkelappen skal fylle en hvit sirkel – hero-en i handleliste og
oppskrifter – betyr det `padding:0`, `align-items:flex-start` og
`width:100%`, ikke midtstilling. Midtstilt blir det en hvit halvmåne i
bunnen.

**Størrelse på hovedlogoen i index** er `clamp(120px, 17vw, 195px)`. Den
følger fliseikonene i begge ender: 194px på full skjerm, 125px på telefon.
Midtpartiet kan ikke matches – mellom 700 og 1000px bytter rutenettet til
færre kolonner uten at skjermen blir smalere, så flisene vokser til 270px.
Et merke på 270px i topplinja ville tatt hele iPad-skjermen. `17vw` bremser
der med vilje.

**De seks planlagte flisene har fortsatt de gamle strekikonene.** Får de
merkelapper senere, er endringen å legge til klassen `merke` og fjerne
`app-name` – da oppfører de seg som de fire andre.

**Innloggingsportene har fortsatt Neam-roboten**, ikke sidens eget
merke. Gjelder `#port .ikon` i index og dashboard og `.gate-icon` i kalender.
Bevisst inntil videre, ikke etterslep.

## Planlagte fliser i index

De seks appene som ikke er bygd ligger skjult bak bryteren **«Vis planlagte»**
i panelhodet. Skjult er standardtilstanden, så de fire ferdige får hele
bredden.

**Bryteren setter klassen `skjul-planlagte` på rutenettet**, ikke
`hidden`-attributtet på hver flis. `.app` har `display:flex`, og det
overstyrer `[hidden]` stille – se fella under.

**`.app.merke` slår `.app-icon` inne i mediaspørringene**, fordi den er mer
spesifikk. Alt som skal gjelde ved lav skjermhøyde må derfor gjentas i en
egen `.app.merke`-regel inne i den mediaspørringen.

## Praktiske feller

**Rekkefølge avgjør ved lik spesifisitet.** En media query må stå *etter*
reglene den skal overstyre. Dette har slått til fem ganger. Femte gang var
`.topbar-back` med `color:var(--ink)` etterfulgt av `.icon-btn` med
`color:var(--paper)` på samme knapp: pila var hvit på nesten hvit bakgrunn.
Den var der og virket, den var bare ikke til å se. To klasser på samme element
som begge setter samme egenskap er et varsel i seg selv. Legg blokker som
overstyrer mye **sist i arket**, og scope dem på en id, så både rekkefølge og
spesifisitet peker samme vei.

**`overflow-x` må være `clip`, ikke `hidden`.** `hidden` på `html`/`body`
gjør dokumentroten til en rullebeholder, og da slutter `position:sticky` å
virke lenger nede. Handleliste hadde **begge** – `clip` øverst i arket og
`hidden` i en senere regel som vant. Samme `.topbar`-regel som virket i
oppskrifter gjorde derfor ingenting der. Å sette regelen ett sted er ikke nok
når en annen regel lenger ned setter den om igjen.

**`esc()` må ta med apostrofen.** Kalender escapet `&<>"` men ikke `'`. Et
avtalenavn med apostrof bryter da ut av et attributt skrevet med enkle
hermetegn. Bruk også `String(s == null ? '' : s)`, ikke `String(s||'')` –
den siste gjør tallet 0 om til tom tekst.

**Sticky i et rutenett trenger `align-self:start`.**

**Popup-vinduer må ligge utenfor visningene.** En boble inne i `#view-home`
forsvinner når den seksjonen settes til `display:none`.

**Modus må slås av før man bytter visning.** Går man til skjemaet mens
redigeringsmodus står på, kommer man tilbake til en halvåpen tilstand uten
veier ut.

**Sjekk om elementet fortsatt finnes.** Fjernes en knapp fra HTML-en, må den
også ut av JS-en. En vakt som `if(a && b && c)` hopper over hele blokka når
ett element mangler – uten feilmelding.

**Den stille vakta slo til for alvor.** `acBind` starter med
`if (!inp || !drop) return;`. Da et skript stoppet halvveis og verken skrev
`VARE_NAVN` eller `.ac-wrap` rundt varefeltet, var resultatet at søket bare
ikke virket. Ingen konsollfeil, ingenting å ta tak i, og feilsøkingen gikk i
feil retning i flere runder. **Legg inn en oppstartssjekk** som sier fra i
konsollen når et element JS-en regner med ikke finnes:

```javascript
['ac-drop-f-name','ac-drop-f-store','ac-drop-f-cat','ac-drop-f-unit']
  .forEach(id => { if(!document.getElementById(id)) console.warn('Mangler:', id); });
```

Fem linjer, gratis, og fanger nettopp denne feilklassen i det sida åpnes.

**Én endring, én bekreftelse.** Et skript som gjør flere flyttinger kan
stoppe halvveis uten at det synes i utskriften. Verifiser hver enkelt endring
ved å **lese den tilbake fra den ferdige fila** – ikke ved å stole på at
skriptet kjørte ferdig. Feilen over er den samme regelen, brutt.

**Elementer uten rutenettplassering havner der det er ledig.**

**Konstanter kan finnes fra før.** `LANDSKAP` var allerede deklarert; en ny
deklarasjon ga syntaksfeil som stoppet hele skriptet.

**Skjermen skal ikke kjefte.** Feilmeldinger med Trace ID hører i konsollen.

**`title`-attributtet vises aldri på berøringsskjerm.**

**`display:flex` i arket overstyrer `hidden`-attributtet.** Nettleserens
standard er `[hidden]{display:none}` – én enkelt regel, som taper mot enhver
klasse som setter `display`. `kort.hidden = true` i JS ser da ut til å virke,
men elementet blir stående. Fella finnes allerede i index: `#port[hidden]`
har en egen regel nettopp derfor. **`#dashKort` har ikke det, så
tilgangsstyringen på Kjøkken dash-flisa virker ikke i dag.** Enten legg inn
`.app[hidden]{display:none}`, eller styr synligheten med en klasse i stedet.

**Base64-bilder ødelegger differ.** Et innebygd bilde er én linje på 40 kB.
Git finner ikke delta mot forrige versjon, GitHub Desktop henger på å tegne
den, og pushen bærer hele fila på nytt. Bilder skal være filer. Se Statiske
filer.

## Statiske filer

Bilder ligger som filer i repoet, ikke som base64 i HTML-en. Butikklogoene
alene ble 926 kB base64 – det er ikke noe å legge i en fil som allerede er
263 kB.

**Dette gjelder nå alle bilder.** Logoer og fliseikoner lå til 27. august
innebygd som base64 – tolv unike bilder i tjue kopier fordelt på fem filer.
De ligger nå i `/bilder/`: `neam-robot.png`, fem `merke-*.png` og seks
`flis-*.png`, til sammen 252 kB. Index falt fra 406 kB til 29 kB, og de fem
filene til sammen fra 1,6 MB til 950 kB. Bildene hentes én gang og caches på
tvers av alle sidene.

**Alle `<img>` skal ha `width` og `height`.** Med base64 var bildet der idet
HTML-en var parset. Filer lastes separat, og uten intrinsiske mål hopper
layouten mens de kommer inn. Attributtene lar nettleseren reservere plassen.
Verdiene er bildets faktiske piksler; CSS-en styrer visningsstørrelsen som
før.

**Historikken krymper ikke.** De gamle blobene ligger igjen i git. Uttrekket
gjør framtidige pusher raske, ikke de som allerede er gjort.

**Webroten er repoets rot.** Build output directory står tomt i Cloudflare,
og da serveres repoet slik det ligger. Ingen `public/`-mappe. `butikklogoer/`
og `vareikoner/` ligger derfor rett i rota og nås som `/butikklogoer/kiwi.png`
og `/vareikoner/melk.webp`.

**Skriv absolutt sti, ikke relativ.** `'/vareikoner/…'`, ikke `'vareikoner/…'`.
Det spiller ingen rolle i dag, men når sidene havner under skallet i 7.5 vil
relative stier peke feil.

**webp er riktig format.** Det er ikke en halvferdig fil selv om nettleseren
ikke viser det som «bilde» i en mappelisting.

Oppslagstabellene (`BUTIKK_LOGO`, `VARE_BILDE`) har både kanoniske navn og
alias som nøkler. Det gjør dem større enn varekatalogen: 1443 varer blir 1822
oppslag. `VARE_NAVN` avledes av tabellen framfor å dupliseres.

`BUTIKK_LOGO` er utvidet til **205 butikker og 326 oppslag**. De 149
opprinnelige filnavnene står urørt, så ingen gamle oppslag ble brutt; nye
kategorier er optikk, smykker og telefoni. Utvidelser skal legges til, ikke
regenereres – da forsvinner kallenavn noen har lagt inn underveis.

**`ALLE_BUTIKKER` og `BUTIKK_LOGO` må utvides i takt.** Står en butikk bare i
lista, får den standardlogoen. Står den bare i tabellen, finner ingen fram
til den.

## Innlogging mot Microsoft

App-registreringen er av typen **Single-page application**. Det gir **24
timers levetid** på refresh-tokenet, og det kan ikke konfigureres bort –
policyene for token- og sesjonslevetid ble fjernet i 2021.

Microsoft-økta i nettleseren lever lenger enn tokenet. Feiler fornyelsen med
utløpt tilgang, sendes brukeren gjennom innloggingen på nytt – det går som
regel rett gjennom. **Sperre mot løkke er påkrevd:** ett forsøk per økt.

**Hver side som starter innlogging må ha sin egen redirect-URI** registrert,
siden adressen bygges som `location.origin + location.pathname`.

Varig løsning er å flytte kodevekslingen til en Pages Function med
klienthemmelighet (typen «Web», 90 dagers glidende vindu).

## Microsoft Graph – skriving

Kjøkken dash oppretter, endrer og sletter avtaler. Det som ikke sto i
dokumentasjonen, men som kostet tid:

**Graph kan ikke flytte en avtale mellom kalendere.** Operasjonen finnes
ikke. Løsningen er å lage avtalen på nytt i den nye kalenderen, kopiere
vedleggene over, og slette originalen **til slutt** – i den rekkefølgen, så
ingenting forsvinner om noe ryker underveis. Gjelder bare enkeltstående
avtaler; en enkeltdag i en serie kan ikke flyttes ut av serien sin, og
kalendervalget låses da.

**Tomt svar er ikke det samme som suksess.** En DELETE svarer 204 uten kropp.
Sjekk statuskoden *før* du returnerer på tom tekst – ellers ser en nektet
sletting ut som en gjennomført.

**Hent vedlegg uten `$select`.** Da følger `contentBytes` med i samme svar, og
små filer kan forhåndsvises uten et ekstra kall per vedlegg.

**Grensa for vedlegg i ett kall er 3 MB.** Større filer krever en
opplastingsøkt. Si fra i stedet for å støtte det halvveis.

**Notatet skrives bare når det er endret.** Avtaler laget i Outlook har
HTML-notat; å skrive tilbake ren tekst uten grunn stripper formateringen
deres.

**Skrivetilgang må stå i scopet fra første innlogging.** Feiler en skriving
med 403, er beskjeden «logg ut og inn igjen» – ikke en teknisk feilkode.

## Funksjoner med utløpsdato

Noe er bygget for å få folk til å ta appen i bruk, ikke for å vare. Terningkast
per person og gjester ved bordet er slikt: gøy de første gangene, og verdien
ligger i at noen åpner appen frivillig og dermed lærer hvor alt annet ligger.

**Slike funksjoner skal bygges så de kan fjernes.** Egne data, egne
funksjoner, ikke vevd inn i resten. Vurderingene ligger allerede for seg på
oppskriften og er i god stand.

**Målestokken bestemmes nå, ikke når spørsmålet kommer opp.** Ikke «synes vi
den er gøy», men noe konkret: har noen lagt inn en vurdering de siste seks
ukene? Uten en avtalt målestokk beholder man ting fordi det var arbeid å lage
dem.

Kandidater å se på etter tre måneders bruk: terningkast per person, gjester i
vurderingene, næringsinnhold per ingrediens.

## Arbeidsmåte

**Én samtale per arbeidsøkt**, ikke én per side og ikke én som lever i
ukevis. Prosjektminnet bærer stakken, beslutningene og historikken videre
mellom tråder – det er knyttet til prosjektet, ikke til tråden. En lang tråd
drar hele sin egen historikk med seg på nytt for hver melding; ti korte
koster mindre enn én som er like lang som alle ti til sammen.

**Ved oppstart** lastes opp den fila som skal endres. Resten ligger i minnet.

**Si hva du ikke skal ta på.** «Jeg rører ikke bilder eller logoer i dag»
sparer mye, fordi de delene da ikke leses grundig. Ikke fjern
oppslagstabellene fra fila for å spare plass – koden regner med at de finnes.

**Modellvalg:** Sonnet til avgrensede endringer, som er det meste her. Opus
til gjennomganger på tvers av filer og til 7.3.

**Linjeskift er låst.** `.gitattributes` i repoets rot setter `* text=auto
eol=lf` og merker bildeformatene som `binary`. Uten den kan git bytte
linjeskift på en fil uten at innholdet er endret, og da ser hele fila ut som
ny i diffen. `oppskrifter.html` hadde dette tidligere. 7.3b er dermed ferdig.

**Avtalt rekkefølge videre:**

1. **Innboks** mellom oppskrifter og handleliste – erstatter fil-broen med en
   KV-nøkkel. Treffer to filer, og kartleggingen den krever er samtidig
   forarbeidet til 7.3.
2. **7.3 refaktorering** til delte filer, med **7.4 typeskala** som en del av
   den – ikke før, da må skalaen endres fem steder og slås sammen etterpå.
3. **7.5 skallet** (`hub.html`).
4. **Service worker.** Må vente til etter skallet: fem frittstående sider og
   én side som bytter innhold krever helt forskjellige cachingstrategier.
   Bygges den før, bygges den to ganger.

**7.3 begynner med kartlegging, ikke med å flytte kode.** Verdiene er ikke
helt like på tvers av filene – skyggen under logoen er `rgba(0,0,0,.26)` i
kalender, `rgba(0,0,0,.28)` i oppskrifter og `rgba(44,62,80,.18)` i
handleliste. Slås de sammen uten å velge først, endrer to sider utseende uten
at noen har bedt om det. Én fil av gangen, deploy og test mellom hver.

## Ikke bestemt ennå

- **Index er blitt en meny, ikke en hjemmeside.** Stor logo, klokke, fire
  fliser. Dashboardet viser faktisk noe; index gjør det ikke. På telefon
  koster det ett trykk før man ser noe nyttig. Verdt å vurdere om index heller
  bør vise dagens middag og den aktive handleøkta, med flisene under.
- **Topplinja i index er blitt høy.** Rundt 230px på full skjerm mot 110px
  før merkelappen kom inn. Se på det på iPad før det avgjøres.
- **Ingen offline.** Ingen service worker, ingen manifest. Handlelista brukes
  i butikk, som er akkurat der dekningen svikter. IndexedDB-bufferen i
  oppskrifter er riktig tenkt, men selve siden laster ikke uten nett. Ligger
  etter skallet i rekkefølgen, se Arbeidsmåte.
- **Ingen navigasjon mellom sidene.** Hver side har nøyaktig én utgang:
  logoen til «/». Fra oppskrift til handleliste er tre trykk og to fulle
  sidelastinger. Sveipen tar deg nå *bakover* på tvers av apper, men det
  finnes fortsatt ingen vei *sidelengs*. Løses av skallet i 7.5, og er den
  største daglige friksjonen slik det står nå.
- **Tre knapper i handleliste venter på en avgjørelse.** `Lagre` ved
  omdøping, `Legg i innboks` og `Hent ingredienser` står i oker. Etter regelen
  er ingen av dem «endre»: de to første lagrer eller legger til, den siste
  gjør ingen av delene. `Legg i innboks` kan like gjerne være lilla, siden den
  går til Oppskriftsboka.
- ~~**`resetAddForm()` og `saveRecipe()` leter etter en knapp som ikke
  finnes.**~~ **Rettet 27.08.2026.** Begge peker nå på
  `.rediger-topp-knapp.lagre`. Presiseringer funnet under rettingen:
  dobbeltkjøring var ikke en reell følge – `saveRecipe` står allerede i
  dobbelttrykk-sperra (`appBusy`) nederst i fila. Den alvorlige følgen var en
  annen: `saveBtn.insertAdjacentElement()` i catch-blokka var *ikke* pakket
  i `if(saveBtn)`, så et mislykket lagringsforsøk kastet en TypeError inne i
  feilhåndteringa og feilmeldingen nådde aldri skjermen. Meldingen legger seg
  nå under `.rediger-topp` i stedet for inne i den sticky knapperaden.
- ~~**Avbryt er rød i redigeringsmodus.**~~ **Avgjort 27.08.2026.**
  Fargeregelen vant: Avbryt er nøytral overalt, rødt betyr slett, og
  advarselen er flyttet til en bekreftelse. Se Avbryt-regelen under
  Knappeklasser.
- **Topplinjene er tomme nå.** `#topbar-brand` er en tom `div` i begge
  appene, og `#topbar-home-actions` i handleliste inneholder bare en
  kommentar. Med pila borte er `.topbar` 28px luft som blir en gradient ved
  rulling – og i undervisninger et grått bånd med skygge og uten innhold.
  Ikke avgjort om den skal fjernes eller fylles.
- **To utrullinger per push.** Både GitHub Pages og Cloudflare Pages bygger
  ved hver push, og begge har neam.no oppført som eget domene. Cloudflare er
  den som faktisk svarer. GitHub Pages kan derfor feile uten at det betyr
  noe – men det gir et rødt kryss som må vurderes hver gang. Slås av under
  Settings → Pages ved å sette Source til None.
- **Testbyrden.** Hver endring verifiseres manuelt på tre enheter, uten
  automatiske sjekker. Et lite selvdiagnose-panel som sjekker at
  nøkkelelementer finnes og at KV svarer ville fanget mye av det som i dag
  oppdages ved å se på skjermen. Se oppstartssjekken under Praktiske feller.
- **Layoutbunken**: mobilstabling på dashboardet, uttoning ved rulling,
  to kolonner i handlelista, formatgjennomgang i kalenderen.
- **Skjemafeltene under 16px** – kjent, ikke rettet i kalender og
  oppskrifter. Handleliste er ferdig.
- **Kjøkken dash er fortsatt låst til `sys@neam.no`.** Planen er ett dash per
  familiemedlem, og da bærer sidenavnet hvem det gjelder – derfor er navnet på
  innlogget bruker tatt ut av toppen. Hvordan de skal skille seg fra hverandre
  ut over navnet er ikke avgjort.
- **Fem butikklogoer har mistet den norske bokstaven i filnavnet**
  (`brdrene-pedersen`, `bjrklund`, `norrna`, `elkjp-phonehouse`,
  `aseco-gull-og-slv`), mens de eldre filene skriver om til `oe`/`aa`
  (`elkjop`, `sostrene-grene`). Tabellen peker på filene slik de faktisk
  heter, så alt virker. Rydd når det passer: fem filnavn og fem linjer.
- **Utseendet på varelinja i handlelista.** Bildene og logoene virker, men
  størrelse, plassering og hvor mye de skal fylle er ikke avgjort.
- **`.icon-btn .badge` mangler `position:relative` på forelderen.** Kjent,
  ikke rørt.
- **Nedtrekket for varenavn viser både kanoniske navn og alias** – 1822
  oppslag mot 1443 varer. Kan bli rotete i bruk. Avventer erfaring før noe
  gjøres.
- **AI-gjennomgang av varekatalogen.** Å la en modell sjekke om bildet
  passer til navnet og om kategorien er riktig, er en god oppgave for AI:
  ensformig, veldefinert, og krever ikke kjennskap til koden. Gjøres som en
  engangsjobb i bunker, ikke som noe som kjører i sida. Tekstsjekken av
  kategori er billig; bildesjekken koster fordi hvert bilde må sendes med.
  Resultatet er en liste med mistanker til gjennomsyn, ikke en dom.
- **Bytte bilde manuelt på en vare.** Et lite bildevelger-felt i
  redigeringsskjemaet, med samme søk-med-bilde som ellers. Dette bør bygges
  først – da har Neam en ferdig mekanisme å betjene når den skal foreslå
  bilder selv. Forslag fra Neam skal fylles inn og vente på godkjenning,
  som alt annet den gjør.
- **Datautveksling mellom appene skal gå gjennom felles lagring, ikke
  gjennom filer.** I dag kopierer `sendTilHandleliste()` en JSON til
  utklippstavla *og* laster den ned; så må noen åpne handleliste, trykke
  «Hent varer fra Oppskriftsboka» og lime inn. Begge appene skriver allerede
  til samme KV. Dette er den hyppigste handlingen på tvers i produktet og det
  ene stedet med manuell bro – på iPhone er nedlasting og gjenopplasting av
  en JSON praktisk talt ubrukelig. **Løsningen er avtalt: skriv til en nøkkel
  som `fh:handleliste-innboks`, og la handleliste vise «7 varer venter fra
  Oppskriftsboka».** Dette er neste økt. Ukemeny til handleliste har samme
  problem og bør med i samme jobb.
- **Nedtelling i skallet.** Trykk på «30 min steketid» i en oppskrift skal
  starte en timer som lever i skallet, ikke i oppskriftsfila – da overlever
  den at man bytter side. Å finne tiden i teksten krever tolkning, altså AI
  eller mønstergjenkjenning: «stek i 30 minutter», «la heve en time», «kok
  opp». Åpne spørsmål: hva skjer når tiden er ute på en kjøkkenskjerm uten
  lyd, og kan flere timere gå samtidig.
- **Flere deltakere per avtale.** I dag viser planraden **én** initial, og
  den kommer av hvilken kalender avtalen ligger i — ikke av hvem som skal
  være med. En avtale som gjelder to eller tre i familien kan derfor ikke
  vises som det. Å få inn flere initialer krever at deltakerne står et sted i
  avtalen: enten ved at den opprettes i flere kalendere samtidig, eller ved
  at deltakerne føres inn i selve avtalen (deltakerfeltet i Graph, eller en
  avtalt notasjon i tittel eller beskrivelse). Valget avgjør både hvordan
  avtaler må opprettes og hvor mye som kan leses ut av det som allerede
  ligger der. Ikke utredet.

- **MET-proxyen bærer fire ting**: yr som værkilde, farevarsler, MET sitt
  tekstvarsel, og hjemmekoordinater i settings-fila.
