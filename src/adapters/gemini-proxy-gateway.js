// Coach gateway port implemented over the Vercel proxy to Gemini (proxy/api/chat.js).
// messages: [{role: 'user'|'model', text}]. Resolves {text, model}; rejects with a user-readable Error.
export function createGeminiProxyGateway(url, timeoutMs = 70000) {
  return {
    async ask({ system, messages }) {
      const startedAt = Date.now(), elapsed = () => ((Date.now() - startedAt) / 1000).toFixed(1) + ' с';
      try {
        const response = await fetch(url, {
          method: 'POST', signal: AbortSignal.timeout(timeoutMs), headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationConfig: { thinkingConfig: { thinkingLevel: 'minimal' } },
            systemInstruction: { parts: [{ text: system }] },
            contents: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`HTTP ${response.status} за ${elapsed()}: ${body.error?.message || response.statusText || 'без описания'}`);
        return { text: body.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || 'Пустой ответ', model: body.modelVersion };
      } catch (e) {
        if (e.name === 'TimeoutError') throw new Error(`Сервер не ответил за ${timeoutMs / 1000} с`);
        if (e.name === 'TypeError') throw new Error(`Нет связи с прокси за ${elapsed()} (${e.message}). Причины: нет сети, блокировка ${new URL(url).host} провайдером или прокси недоступен. Страница открыта с ${location.origin}`);
        throw e;
      }
    },
  };
}
