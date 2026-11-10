import assert from 'node:assert/strict';
import { createDeepSeekProxyGateway } from '../src/adapters/deepseek-proxy-gateway.js';
import { POST } from '../proxy/api/chat.js';
import { initialData } from '../src/domain/schema.js';
import { createStore } from '../src/application/store.js';
import { createUseCases } from '../src/application/use-cases.js';

const originalFetch = globalThis.fetch, key = process.env.DEEPSEEK_KEY;
try {
  process.env.DEEPSEEK_KEY = 'transport-test-only';
  let upstreamCalls = 0, captured;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    const body = JSON.parse(options.body); captured = body; upstreamCalls++;
    assert.equal(body.model, 'deepseek-flash');
    assert.deepEqual(body.thinking, { type: 'disabled' });
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.equal(body.responseSchema, undefined);
    assert.equal(options.headers.Authorization, 'Bearer transport-test-only');
    return new Response(JSON.stringify(upstreamCalls === 1 ? { error: { message: 'busy' } } : { model: 'deepseek-flash', choices: [{ message: { content: '{"text":"Ответ"}' } }] }), { status: upstreamCalls === 1 ? 503 : 200 });
  };
  const reply = await POST(new Request('https://proxy.test/api/chat', { method: 'POST', headers: { Origin: 'http://localhost:8000' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'json please' }], response_format: { type: 'json_object' }, model: 'untrusted' }) }));
  assert.equal(reply.status, 200); assert.equal(upstreamCalls, 2);
  assert.equal((await POST(new Request('https://proxy.test/api/chat', { method: 'POST', headers: { Origin: 'https://evil.test' }, body: '{}' }))).status, 403);

  let calls = 0;
  globalThis.fetch = async (_, options) => {
    const request = JSON.parse(options.body); calls++;
    assert.deepEqual(request.messages, [{ role: 'system', content: 'json rules' }, { role: 'assistant', content: 'old' }, { role: 'user', content: 'q' }]);
    assert.deepEqual(request.response_format, { type: 'json_object' });
    assert.equal(JSON.stringify(request).includes('transport-test-only'), false);
    return new Response(JSON.stringify({ model: 'deepseek-flash', choices: [{ message: { content: calls === 1 ? '   ' : '{"text":"OK"}' } }] }));
  };
  const gateway = createDeepSeekProxyGateway('https://proxy.test/api/chat');
  assert.equal((await gateway.ask({ system: 'json rules', messages: [{ role: 'model', text: 'old' }, { role: 'user', text: 'q' }], json: true })).text, '{"text":"OK"}');
  assert.equal(calls, 2);
  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('{"choices":[{"message":{"content":""}}]}'); };
  await assert.rejects(gateway.ask({ system: 'json', messages: [], json: true }), /пустой ответ/);
  assert.equal(calls, 2);
  console.log('PASS DeepSeek transport: server-only key, fixed model, thinking disabled, JSON object, retry 503/empty, role mapping');

  // Exercise real validators and use-case entry points with the new gateway protocol.
  const data = initialData(), slot = data.days.A[0], group = data.groups.find(g => g.items.some(i => i.id === slot.weightId));
  const store = createStore({ load: () => data, save: () => true });
  let payload = { suggestions: [{ kind: 'new', name: 'Тестовый жим', groupId: group.id, equipment: null, reason: 'Замена', difference: 'Другое движение' }] };
  globalThis.fetch = async (_, options) => {
    captured = JSON.parse(options.body);
    assert.deepEqual(captured.response_format, { type: 'json_object' });
    assert.match(captured.messages[0].content, /json/);
    assert.match(captured.messages[0].content, /Пример/);
    return new Response(JSON.stringify({ model: 'deepseek-flash', choices: [{ message: { content: JSON.stringify(payload) } }] }));
  };
  const uc = createUseCases({ store, coach: gateway });
  assert.equal((await uc.suggestAlternatives('A', slot.id, { reason: 'busy', equipment: [] }))[0].name, 'Тестовый жим');
  payload = { status: 'ready', setup: 'Настройте скамью.', movement: 'Контролируйте движение.', attention: 'Не продолжайте при боли.', mistakes: 'Не теряйте опору.' };
  assert.equal((await uc.generateTechnique(slot.weightId, { movement: 'Жим гантелей', equipment: null })).model, 'deepseek-flash');
  assert.equal(store.state.groups.flatMap(g => g.items).some(i => i.technique?.source === 'ai'), false);
  console.log('PASS alternatives and technique: prompt schema/example, response validation, no implicit saving');
} finally {
  globalThis.fetch = originalFetch;
  if (key === undefined) delete process.env.DEEPSEEK_KEY; else process.env.DEEPSEEK_KEY = key;
}
