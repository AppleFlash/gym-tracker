// Proxy to Gemini API. Runs in Frankfurt: Cloudflare is throttled in Russia, Gemini blocks Russian IPs.
// Key lives in the GEMINI_KEY env var, never in the app.
const ORIGINS = ['https://appleflash.github.io', 'http://localhost:8000'];
const MODEL = 'gemini-flash-lite-latest';

const cors = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

const error = (origin, status, message) =>
  new Response(JSON.stringify({ error: { message } }), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });

// Preflight always passes so the app can read the real reason from POST
export function OPTIONS(req) {
  return new Response(null, { headers: cors(req.headers.get('origin') || '*') });
}

export async function POST(req) {
  const origin = req.headers.get('origin');
  if (!ORIGINS.includes(origin)) return error(origin || '*', 403, `Прокси: адрес ${origin || '(нет Origin)'} не в списке разрешённых`);
  const body = await req.text();
  const deadline = Date.now() + 55000;
  let res;
  // Free tier gets 503 first when Google is overloaded; a retry after a pause often passes
  for (const pause of [0, 1500, 4000]) {
    await new Promise(r => setTimeout(r, pause));
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_KEY },
        body,
        signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
      });
    } catch {
      return error(origin, 504, `Прокси: Gemini (${MODEL}) не ответил за 55 с`);
    }
    if (res.status !== 503) break;
  }
  return new Response(res.body, { status: res.status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });
}
