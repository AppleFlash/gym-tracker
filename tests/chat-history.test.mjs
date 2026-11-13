import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createChatHistory } from '../src/application/chat-history.js';
import { createLocalStorageRepository } from '../src/adapters/local-storage-repository.js';
import { createStore } from '../src/application/store.js';
import { createUseCases } from '../src/application/use-cases.js';

const stored = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => { stored.set(key, String(value)); },
} });
const open = () => createChatHistory(createLocalStorageRepository('chats'));
beforeEach(() => stored.clear());

test('questions survive a restart before the reply, and replies retain context and accepted proposals', () => {
  const history = open();
  const context = { kind: 'exercise', weightId: 'squat', workoutId: 'workout', label: 'Присед' };
  const messages = [{ role: 'user', text: 'Как прогресс?', pending: true }];
  assert.ok(history.save(messages, context).ok);
  const id = history.active.id;
  assert.deepEqual(open().active.messages, messages);
  assert.deepEqual(open().active.context, context);
  delete messages[0].pending;
  messages.push({ role: 'model', text: 'Продолжайте.', model: 'coach', proposals: [{ id: 'fact', type: 'profile', text: 'Цель: сила', accepted: true }] });
  assert.ok(history.save(messages, context).ok);
  messages[1].text = 'Изменено только в памяти';
  const restored = open();
  assert.equal(restored.sessions.length, 1);
  assert.equal(restored.active.id, id);
  assert.equal(restored.active.messages[1].text, 'Продолжайте.');
  assert.equal(restored.active.messages[1].proposals[0].accepted, true);
});

test('only ten nonempty sessions remain, evicting the least recently updated rather than the selected session', () => {
  const history = open();
  history.start();
  history.start();
  assert.equal(open().sessions.length, 0);
  const ids = [];
  for (let i = 0; i < 10; i++) {
    history.start();
    history.save([{ role: 'user', text: String(i) }], null);
    ids.push(history.active.id);
  }
  history.select(ids[0]);
  history.save([...history.active.messages, { role: 'model', text: 'Обновлён' }], null);
  history.select(ids[1]);
  assert.equal(open().active.id, ids[1]);
  assert.equal(history.sessions[0].id, ids[0]);
  history.start();
  history.save([{ role: 'user', text: 'Одиннадцатый' }], null);
  assert.equal(open().sessions.length, 10);
  assert.ok(open().sessions.some(s => s.id === ids[0]));
  assert.ok(!open().sessions.some(s => s.id === ids[1]));
});

test('deleting the active session selects the newest remaining one; clearing leaves diary data intact', () => {
  localStorage.setItem('diary', '{"workouts":["keep"]}');
  const history = open();
  history.save([{ role: 'user', text: 'Первый' }], null);
  const firstId = history.active.id;
  history.start();
  history.save([{ role: 'user', text: 'Второй' }], null);
  const secondId = history.active.id;
  history.start();
  history.save([{ role: 'user', text: 'Третий' }], null);
  const thirdId = history.active.id;
  history.remove(firstId);
  assert.equal(open().active.id, thirdId);
  history.remove(thirdId);
  assert.equal(open().active.id, secondId);
  history.clear();
  assert.equal(open().sessions.length, 0);
  assert.equal(open().active, null);
  assert.equal(localStorage.getItem('diary'), '{"workouts":["keep"]}');
});

test('storage failures do not evict, delete, clear, or switch persisted sessions', t => {
  const history = open();
  for (let i = 0; i < 10; i++) {
    history.start();
    history.save([{ role: 'user', text: 'Сохранён ' + i }], null);
  }
  const id = history.active.id;
  history.start();
  const before = localStorage.getItem('chats'), ids = history.sessions.map(s => s.id);
  t.mock.method(localStorage, 'setItem', () => { throw new Error('quota'); });
  for (const action of [
    () => history.save([{ role: 'user', text: 'Не сохранён' }], null),
    () => history.remove(id), () => history.clear(), () => history.select(id),
  ]) {
    assert.ok(action().error);
    assert.equal(history.active, null);
    assert.deepEqual(history.sessions.map(s => s.id), ids);
    assert.equal(localStorage.getItem('chats'), before);
  }
});

test('unreadable history is kept untouched until explicit clearing, including malformed nested messages', () => {
  for (const raw of ['{broken', '{"sessions":{}}', JSON.stringify({ activeId: 'bad', sessions: [{ id: 'bad', updatedAt: new Date().toISOString(), context: null, messages: [{ role: 'model', text: 'Ответ', proposals: [{ id: 'p', type: 'agreement', text: 'Нет review' }] }] }] })]) {
    localStorage.setItem('chats', raw);
    const history = open();
    assert.ok(history.loadError);
    assert.ok(history.save([{ role: 'user', text: 'Новый' }], null).error);
    assert.equal(localStorage.getItem('chats'), raw);
    assert.ok(history.clear().ok);
    assert.equal(open().loadError, null);
  }
});

test('reapplying a restored proposal cannot duplicate a fact or agreement when its chat receipt was not saved', () => {
  const store = createStore(createLocalStorageRepository('diary'));
  const uc = createUseCases({ store });
  const fact = { id: 'proposal-fact', type: 'profile', text: 'Хочу стать сильнее' };
  const agreement = { id: 'proposal-agreement', type: 'agreement', text: 'Следить за повторами', scope: { kind: 'program' }, review: { text: 'Оценить прогресс', afterRuns: null } };
  const firstFact = uc.acceptProposal(fact), firstAgreement = uc.acceptProposal(agreement);
  const restoredStore = createStore(createLocalStorageRepository('diary'));
  const restored = createUseCases({ store: restoredStore });
  assert.equal(restored.acceptProposal(fact).value, firstFact.value);
  assert.equal(restored.acceptProposal(agreement).value, firstAgreement.value);
  assert.equal(restoredStore.state.profile.facts.length, 1);
  assert.equal(restoredStore.state.agreements.length, 1);
});
