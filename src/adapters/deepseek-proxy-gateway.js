// Gateway port: the key and provider settings belong to the proxy.
export function createDeepSeekProxyGateway(url, timeoutMs = 70000) {
  return {
    async ask({ system, messages, json = false }) {
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await fetch(url, {
            method: 'POST', signal: AbortSignal.timeout(timeoutMs), headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'system', content: system }, ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.text }))],
              ...(json ? { response_format: { type: 'json_object' } } : {}),
            }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.error?.message || response.statusText || 'Ошибка прокси'}`);
          const text = body.choices?.[0]?.message?.content;
          if (typeof text === 'string' && text.trim()) return { text, model: body.model };
          if (attempt) throw new Error('ИИ вернул пустой ответ. Повторите запрос.');
        }
      } catch (e) {
        if (e.name === 'TimeoutError') throw new Error(`Сервер не ответил за ${timeoutMs / 1000} с`);
        if (e.name === 'TypeError') throw new Error('Нет связи с ИИ-прокси. Проверьте сеть и повторите запрос.');
        throw e;
      }
    },
  };
}
