// Proxy to Gemini API. Runs in Frankfurt: Cloudflare is throttled in Russia, Gemini blocks Russian IPs.
// Key lives in the GEMINI_KEY env var, never in the app.
const ORIGINS = ['https://appleflash.github.io', 'http://localhost:8000'];
const MODEL = 'gemini-flash-lite-latest';

const cors = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

export function OPTIONS(req) {
  const origin = req.headers.get('origin');
  return ORIGINS.includes(origin) ? new Response(null, { headers: cors(origin) }) : new Response('Forbidden', { status: 403 });
}

export async function POST(req) {
  const origin = req.headers.get('origin');
  if (!ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_KEY },
      body: await req.text(),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    res = new Response(JSON.stringify({ error: { message: 'Модель не ответила вовремя' } }), { status: 504 });
  }
  return new Response(res.body, { status: res.status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });
}
