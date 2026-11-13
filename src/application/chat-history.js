import { uid } from '../domain/shared.js';

const LIMIT = 10;
const STORAGE_ERROR = 'Не удалось сохранить историю диалогов. Проверьте свободное место и доступ к хранилищу браузера.';
const LOAD_ERROR = 'Не удалось прочитать историю диалогов. Очистите её через «История», чтобы снова сохранять переписку. Данные тренировок не затронуты.';
const text = value => typeof value === 'string';
const optionalText = value => value == null || text(value);
const optionalFlag = value => value === undefined || typeof value === 'boolean';
const validContext = c => c === null || !!c && text(c.label) && (c.kind === 'workout' && text(c.id)
  || c.kind === 'exercise' && text(c.weightId) && optionalText(c.workoutId));
const validProposal = p => !!p && text(p.id) && !!p.id && text(p.text) && optionalFlag(p.accepted)
  && (p.type === 'profile' || p.type === 'agreement' && !!p.scope
    && (p.scope.kind === 'program' || p.scope.kind === 'day' && text(p.scope.day) || p.scope.kind === 'exercise' && text(p.scope.weightId))
    && !!p.review && text(p.review.text) && (p.review.afterRuns == null || Number.isInteger(p.review.afterRuns))
    && optionalText(p.baselineWorkoutId) && optionalText(p.replaces));
const validMessage = m => !!m && ['user', 'model'].includes(m.role) && text(m.text)
  && optionalText(m.model) && optionalFlag(m.err) && optionalFlag(m.pending)
  && (m.proposals === undefined || Array.isArray(m.proposals) && m.proposals.every(validProposal));
const validSession = s => !!s && text(s.id) && !!s.id && text(s.updatedAt) && Number.isFinite(Date.parse(s.updatedAt))
  && validContext(s.context) && Array.isArray(s.messages) && s.messages.length > 0 && s.messages.every(validMessage);
const validHistory = h => !!h && Array.isArray(h.sessions) && h.sessions.length <= LIMIT && h.sessions.every(validSession)
  && new Set(h.sessions.map(s => s.id)).size === h.sessions.length
  && (h.activeId === null || text(h.activeId) && h.sessions.some(s => s.id === h.activeId));

// The diary and chat history have separate repositories: clearing or corrupting one cannot change the other.
export function createChatHistory(repository) {
  let state = { sessions: [], activeId: null }, loadError = null;
  try {
    const saved = repository.load();
    if (saved !== null) {
      if (!validHistory(saved)) throw new Error(LOAD_ERROR);
      state = saved;
    }
  } catch { loadError = LOAD_ERROR; }

  const commit = (next, clearing = false) => {
    if (loadError && !clearing) return { error: loadError };
    if (!repository.save(next)) return { error: STORAGE_ERROR };
    state = next;
    loadError = null;
    return { ok: true };
  };

  return {
    get sessions() { return state.sessions; },
    get active() { return state.sessions.find(s => s.id === state.activeId) || null; },
    get loadError() { return loadError; },
    save(messages, context) {
      if (!messages.length) return null;
      const session = { id: state.activeId || uid(), updatedAt: new Date().toISOString(), context: structuredClone(context), messages: structuredClone(messages) };
      return commit({ activeId: session.id, sessions: [session, ...state.sessions.filter(s => s.id !== session.id)].slice(0, LIMIT) });
    },
    start: () => commit({ ...state, activeId: null }),
    select(id) {
      return state.sessions.some(s => s.id === id) ? commit({ ...state, activeId: id }) : null;
    },
    remove(id) {
      if (!state.sessions.some(s => s.id === id)) return null;
      const sessions = state.sessions.filter(s => s.id !== id);
      return commit({ sessions, activeId: state.activeId === id ? sessions[0]?.id || null : state.activeId });
    },
    clear: () => commit({ sessions: [], activeId: null }, true),
  };
}
