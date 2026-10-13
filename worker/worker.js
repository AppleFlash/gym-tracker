// Proxy to Gemini API. Key lives in the GEMINI_KEY secret, never in the app.
const ORIGINS = ['https://appleflash.github.io', 'http://localhost:8000'];

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin');
    if (!ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    // Chosen model first (?model=lite|flash); the other one when it is overloaded or out of quota
    const lite = 'gemini-flash-lite-latest', flash = 'gemini-flash-latest';
    const models = new URL(req.url).searchParams.get('model') === 'flash' ? [flash, lite] : [lite, flash];
    const body = await req.text();
    let res;
    for (const model of models) {
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
          body,
          signal: AbortSignal.timeout(25000),
        });
        if (res.status !== 429 && res.status !== 503) break;
      } catch {
        res = new Response(JSON.stringify({ error: { message: 'Модель не ответила вовремя' } }), { status: 504 });
      }
    }
    return new Response(res.body, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
