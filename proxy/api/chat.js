// Proxy to Gemini API. Runs in Frankfurt: Cloudflare is throttled in Russia, Gemini blocks Russian IPs.
// Key lives in the GEMINI_KEY env var, never in the app.
const ORIGINS = ['https://appleflash.github.io', 'http://localhost:8000'];
// Simple, fast models with separate free quotas; the next one is tried when the previous fails
const MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];

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
  let res;
  for (const model of MODELS) {
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_KEY },
        body,
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      res = error(origin, 504, `Прокси: ${MODELS.join(' и ')} не ответили за 25 с`);
      continue;
    }
    if (![429, 500, 503].includes(res.status)) break;
  }
  return new Response(res.body, { status: res.status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });
}

