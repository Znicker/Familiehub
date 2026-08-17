/**
 * Mellomtjener mot Anthropic.
 *
 * Sidene kaller /api/claude i stedet for api.anthropic.com direkte.
 * Denne filen legger på API-nøkkelen underveis, slik at nøkkelen aldri
 * havner i koden som lastes ned til nettleseren.
 *
 * Nøkkelen settes i Cloudflare: Settings -> Variables and Secrets,
 * som en hemmelighet med navnet ANTHROPIC_API_KEY.
 *
 * Tom liste betyr at alle slipper til. Fyll inn e-postadressene til
 * familien for å begrense tilgangen.
 */
const SLIPP_INN = [];

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/* Hvor mange kall én bruker kan gjøre per minutt. Beskytter mot at en
   løpsk løkke i appen tømmer kvoten på et blunk. */
const MAKS_PER_MINUTT = 20;
const teller = new Map();

function svar(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function feil(melding, status) {
  return svar({ error: { type: 'proxy_error', message: melding } }, status);
}

/* Sjekker Microsoft-tokenet appen sender med, og returnerer e-postadressen
   det tilhører. Uten gyldig token slipper ingen gjennom. */
/* Leser e-posten ut av Access-tokenet (JWT). Cloudflare har allerede
   sjekket tokenet foer forespoerselen naar hit, saa vi trenger bare aa
   lese innholdet, ikke aa verifisere det paa nytt. */
function epostFraJwt(jwt) {
  try {
    const bit = jwt.split('.')[1];
    if (!bit) return null;
    const json = atob(bit.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(json);
    return (data.email || data.identity || '').toLowerCase() || null;
  } catch (e) {
    return null;
  }
}

async function hvemErDette(request) {
  // 1) E-post-header fra porten (settes i noen oppsett).
  const accessEpost = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (accessEpost) return accessEpost.toLowerCase();

  // 2) Access-tokenet (JWT) - inneholder alltid e-posten.
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (jwt) {
    const e = epostFraJwt(jwt);
    if (e) return e;
  }

  // 3) Reserveloesning: Microsoft-token, hvis appen sender et.
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;

  const r = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: auth }
  });
  if (!r.ok) return null;

  const me = await r.json();
  return (me.userPrincipalName || me.mail || '').toLowerCase();
}

function overGrensen(epost) {
  const naa = Date.now();
  const liste = (teller.get(epost) || []).filter(t => naa - t < 60000);
  if (liste.length >= MAKS_PER_MINUTT) return true;
  liste.push(naa);
  teller.set(epost, liste);
  return false;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return feil('API-nøkkelen er ikke satt opp på tjeneren.', 500);
  }

  const epost = await hvemErDette(request);
  if (!epost) {
    const sawAccess = !!(request.headers.get('Cf-Access-Jwt-Assertion') ||
                         request.headers.get('Cf-Access-Authenticated-User-Email'));
    return feil(
      sawAccess
        ? 'Innlogget, men klarte ikke å lese e-posten fra porten.'
        : 'Fant ingen Access-identitet på forespørselen.',
      401
    );
  }
  if (SLIPP_INN.length && !SLIPP_INN.map(e => e.toLowerCase()).includes(epost)) {
    return feil('Denne kontoen har ikke tilgang.', 403);
  }
  if (overGrensen(epost)) {
    return feil('For mange forespørsler på kort tid. Vent litt og prøv igjen.', 429);
  }

  let kropp;
  try {
    kropp = await request.json();
  } catch (e) {
    return feil('Forespørselen var ikke gyldig JSON.', 400);
  }

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify(kropp)
    });

    /* Svaret sendes videre som det er, slik at appen kan lese både
       vellykkede svar og feilmeldinger fra Anthropic uendret. */
    const tekst = await r.text();
    return new Response(tekst, {
      status: r.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return feil('Fikk ikke kontakt med AI-tjenesten: ' + e.message, 502);
  }
}

/* Alt annet enn POST avvises, så adressen ikke kan brukes til noe annet. */
export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return feil('Bare POST er tillatt her.', 405);
}
