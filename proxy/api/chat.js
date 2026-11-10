// DeepSeek key stays on the server.
const ORIGINS = ['https://appleflash.github.io', 'http://localhost:8000'];

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
  let body;
  try { body = await req.json(); } catch { return error(origin, 400, 'Некорректный JSON'); }
  if (!Array.isArray(body?.messages) || !body.messages.length || body.messages.some(m => !m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) return error(origin, 400, 'Некорректные сообщения');
  if (!process.env.DEEPSEEK_KEY) return error(origin, 503, 'Прокси: DEEPSEEK_KEY не настроен');
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.DEEPSEEK_KEY },
        body: JSON.stringify({ model: 'deepseek-flash', messages: body.messages, thinking: { type: 'disabled' }, max_tokens: 4096, ...(body.response_format?.type === 'json_object' ? { response_format: { type: 'json_object' } } : {}) }),
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      return error(origin, 504, 'Прокси: DeepSeek не ответил за 25 с');
    }
    if (!attempt && [429, 500, 503].includes(res.status)) { await res.body?.cancel(); continue; }
    break;
  }
  return new Response(res.body, { status: res.status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });
}

