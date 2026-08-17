/* ============================================================
   Familie Hub – delt lagring (Cloudflare Pages Function)

   Ligger i repoet som:  functions/api/data.js
   Gir endepunktet:      /api/data

   Enkelt nøkkel–verdi-lager oppå Cloudflare KV, delt av hele
   familien. Cloudflare Access beskytter neam.no (og dermed også
   dette endepunktet), så bare innloggede familiemedlemmer når det.

     GET  /api/data?key=<nøkkel>   -> { "value": <lagret verdi | null> }
     PUT  /api/data?key=<nøkkel>   body = JSON  -> { "ok": true }

   Krever en KV-binding kalt FAMILIE_KV på Pages-prosjektet
   (Settings → Bindings → KV namespace → Variable name: FAMILIE_KV).
   ============================================================ */

const PREFIX = 'fh:';           // holder nøklene adskilt fra evt. annet i samme KV
const MAX_KEY_LEN = 200;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function lesNokkel(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return { feil: 'mangler key' };
  if (key.length > MAX_KEY_LEN) return { feil: 'key for lang' };
  return { key };
}

export async function onRequestGet({ request, env }) {
  const { key, feil } = lesNokkel(request);
  if (feil) return json({ error: feil }, 400);
  if (!env.FAMILIE_KV) return json({ error: 'KV ikke bundet (FAMILIE_KV mangler)' }, 500);

  const raw = await env.FAMILIE_KV.get(PREFIX + key);
  let value = null;
  if (raw != null) {
    try { value = JSON.parse(raw); }
    catch (e) { value = null; }   // ødelagt verdi behandles som tom
  }
  return json({ value });
}

export async function onRequestPut({ request, env }) {
  const { key, feil } = lesNokkel(request);
  if (feil) return json({ error: feil }, 400);
  if (!env.FAMILIE_KV) return json({ error: 'KV ikke bundet (FAMILIE_KV mangler)' }, 500);

  let value;
  try { value = await request.json(); }
  catch (e) { return json({ error: 'ugyldig JSON i body' }, 400); }

  await env.FAMILIE_KV.put(PREFIX + key, JSON.stringify(value));
  return json({ ok: true });
}

/* Enkelt svar på andre metoder, så feilsøking blir lettere. */
export async function onRequest({ request }) {
  return json({ error: 'bruk GET eller PUT med ?key=' , method: request.method }, 405);
}
