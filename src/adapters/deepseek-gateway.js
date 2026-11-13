// Gateway port: calls DeepSeek directly with the user's own key (read on every request, so changes apply at once).
const URL = 'https://api.deepseek.com/chat/completions';
export function createDeepSeekGateway(getKey, timeoutMs = 70000) {
  return {
    async ask({ system, messages, json = false }) {
      const key = getKey();
      if (!key) throw new Error('Не задан API Key. Укажите его в Профиле → Настройки.');
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await fetch(URL, {
            method: 'POST', signal: AbortSignal.timeout(timeoutMs), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
            body: JSON.stringify({
              model: 'deepseek-flash', thinking: { type: 'disabled' }, max_tokens: 4096,
              messages: [{ role: 'system', content: system }, ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.text }))],
              ...(json ? { response_format: { type: 'json_object' } } : {}),
            }),
          });
          const body = await response.json().catch(() => ({}));
          if (response.status === 401) throw new Error('API Key не принят DeepSeek. Проверьте ключ в Настройках.');
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.error?.message || response.statusText || 'Ошибка DeepSeek'}`);
          const text = body.choices?.[0]?.message?.content;
          if (typeof text === 'string' && text.trim()) return { text, model: body.model };
          if (attempt) throw new Error('ИИ вернул пустой ответ. Повторите запрос.');
        }
      } catch (e) {
        if (e.name === 'TimeoutError') throw new Error(`Сервер не ответил за ${timeoutMs / 1000} с`);
        if (e.name === 'TypeError') throw new Error('Нет связи с DeepSeek. Проверьте сеть и повторите запрос.');
        throw e;
      }
    },
  };
}
