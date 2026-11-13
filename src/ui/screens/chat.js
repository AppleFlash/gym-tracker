// AI coach chat. Transcripts are saved separately from the diary; a visible context narrows the discussion.
import { ctx, view, data, applied } from '../context.js';
import { esc, markdown } from '../format.js';
import { go } from '../router.js';
import { uid } from '../../domain/shared.js';

const messagesHtml = () => (view.chat.map((m, mi) => `<div class="msg ${m.role}">${m.role === 'model' ? markdown(m.text) : esc(m.text)}${(m.proposals || []).map((p, pi) => proposalHtml(p, mi, pi)).join('')}${m.model ? `<div class="msg-meta">${esc(m.model)}</div>` : ''}${m.role === 'user' && (m.pending || m.err) && !view.chatBusy && mi === view.chat.findLastIndex(message => message.role === 'user') ? `<div class="chat-retry"><span>${m.pending ? 'Ответ прерван' : 'Ответ не получен'}</span><button class="btn small" data-action="retryChat">Повторить</button></div>` : ''}</div>`).join('')
  + (view.chatBusy ? '<div class="msg model typing">Думаю…</div>' : '')) || '<p class="note">Например: «Как прошла последняя тренировка?»</p>';

export function chatPage() {
  const context = view.chatContext;
  return `<div class="chat-page"><div class="chat-top">${context ? `<div class="chat-context"><span>Контекст: ${esc(context.label)}</span><button type="button" class="icon-btn" data-action="clearChatContext" aria-label="Убрать контекст">✕</button></div>` : ''}<button class="btn small" data-action="chatHistory" data-chat-idle>История</button><button class="btn small" data-action="agreements">Договорённости</button><button class="btn small" id="newChat" data-action="newChat">+ Новый диалог</button></div><div id="chatlog" class="chatlog">${messagesHtml()}</div><form id="chatForm" class="chat-box"><textarea name="q" rows="1" placeholder="Вопрос о тренировках…" aria-label="Вопрос">${esc(view.chatPrefill)}</textarea><div class="chat-bar"><span></span><button class="btn primary small" id="chatSend" aria-label="Отправить">→</button></div></form></div>`;
}

export function restoreChat() {
  const session = ctx.chats.active;
  Object.assign(view, { chat: structuredClone(session?.messages || []), chatContext: structuredClone(session?.context || null), chatPrefill: '' });
}

function saveChat() {
  return applied(ctx.chats.save(view.chat, view.chatContext));
}

function proposalAccepted(proposal) {
  return proposal.accepted || data().profile.facts.some(f => f.id === proposal.id) || data().agreements.some(a => a.id === proposal.id);
}

export function chatHistoryHtml() {
  const sessions = ctx.chats.sessions, activeId = ctx.chats.active?.id;
  return `<dialog class="modal technique-modal" aria-labelledby="chatHistoryTitle"><section class="card catalog-shell technique-shell"><div class="catalog-content technique-content"><h2 class="technique-title" id="chatHistoryTitle">История диалогов</h2><p class="technique-intro">Сохраняются последние 10 диалогов. При превышении лимита удаляется диалог с самой давней активностью.</p>${ctx.chats.loadError ? `<p class="notice error" role="alert">${esc(ctx.chats.loadError)}</p>` : ''}${sessions.length ? sessions.map(session => {
    const title = session.messages.find(m => m.role === 'user')?.text.replace(/\s+/g, ' ').slice(0, 100) || 'Диалог';
    const date = new Date(session.updatedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<div class="chat-session"><button class="catalog-row" data-action="openChatSession" data-id="${esc(session.id)}" ${session.id === activeId ? 'aria-current="true"' : ''}><span><strong>${esc(title)}</strong><small>${esc(date)}${session.id === activeId ? ' · Открыт' : ''}</small></span></button><button class="btn small danger" data-action="deleteChatSession" data-id="${esc(session.id)}" aria-label="Удалить диалог: ${esc(title)}">Удалить</button></div>`;
  }).join('') : '<p class="technique-intro">Здесь появятся отправленные диалоги.</p>'}<div class="technique-actions"><button class="btn danger" data-action="clearChatHistory" ${sessions.length || ctx.chats.loadError ? '' : 'disabled'}>Удалить всю историю</button></div></div><footer class="sheet-footer"><button class="btn" data-action="close">Закрыть</button></footer></section></dialog>`;
}

const scopeLabel = scope => scope.kind === 'program' ? 'Вся программа' : scope.kind === 'day' ? 'День ' + (scope.day === 'star' ? '★' : scope.day) : data().groups.flatMap(g => g.items).find(i => i.id === scope.weightId)?.name || 'Упражнение';
function proposalHtml(p, message, proposal) {
  const replaced = p.replaces && data().agreements.find(a => a.id === p.replaces);
  return `<section class="coach-proposal"><strong>${p.type === 'profile' ? 'Факт для профиля' : 'Предложение договорённости'}</strong><p>${esc(p.text)}</p>${p.type === 'agreement' ? `<p class="note">${esc(scopeLabel(p.scope))}. Оценка: ${esc(p.review.text)}${p.review.afterRuns ? ` · после ${p.review.afterRuns} выполнений` : ''}</p>${p.baselineWorkoutId ? `<p class="note">Исходное занятие: ${esc(data().workouts.find(w => w.id === p.baselineWorkoutId)?.date || p.baselineWorkoutId)}</p>` : ''}${replaced ? `<p class="note">Заменяет: ${esc(replaced.text)}</p>` : ''}` : ''}<button class="btn small" data-action="acceptCoachProposal" data-message="${message}" data-proposal="${proposal}" ${proposalAccepted(p) ? 'disabled' : ''}>${proposalAccepted(p) ? 'Сохранено' : p.type === 'profile' ? 'Сохранить в профиль' : 'Принять'}</button></section>`;
}

export function agreementsHtml() {
  const agreements = [...data().agreements].reverse();
  return `<dialog class="modal technique-modal" aria-labelledby="agreementsTitle"><section class="card catalog-shell technique-shell"><div class="catalog-content technique-content"><h2 class="technique-title" id="agreementsTitle">Договорённости</h2>${agreements.length ? agreements.map(a => `<section class="coach-agreement"><p>${esc(a.text)}</p><p class="note">${esc(scopeLabel(a.scope))} · ${a.status === 'active' ? 'Активна' : a.status === 'done' ? 'Завершена' : 'Отменена'}</p><p class="note">Оценка: ${esc(a.review.text)}${a.review.afterRuns ? ` · после ${a.review.afterRuns} выполнений` : ''}</p>${a.baseline ? `<p class="note">Исходные показатели · ${esc(a.baseline.date)}: ${a.baseline.sets.map(s => esc(s.weight + ' × ' + s.reps)).join(', ')}</p>` : ''}${a.status === 'active' ? `<div class="footer-actions"><button class="btn small" data-action="closeCoachAgreement" data-id="${esc(a.id)}" data-status="done">Завершить</button><button class="btn small" data-action="closeCoachAgreement" data-id="${esc(a.id)}" data-status="cancelled">Отменить</button></div>` : ''}</section>`).join('') : '<p class="technique-intro">Принятые планы наблюдения появятся здесь.</p>'}</div><footer class="sheet-footer"><button class="btn" data-action="close">Закрыть</button></footer></section></dialog>`;
}

function resizeQuestion(field) {
  field.style.height = 'auto';
  field.style.height = (field.scrollHeight + 1) + 'px'; // Round up fractional line heights to avoid a one-row scrollbar.
}

// Updates only the conversation, keeping the typed question and keyboard focus.
export function drawChat() {
  const log = document.getElementById('chatlog');
  if (log) { log.innerHTML = messagesHtml(); log.scrollTop = log.scrollHeight; }
  const field = document.querySelector('#chatForm textarea');
  if (field) resizeQuestion(field);
  const send = document.getElementById('chatSend');
  if (send) send.disabled = view.chatBusy;
  document.querySelectorAll('[data-chat-idle]').forEach(button => { button.disabled = view.chatBusy; });
  const reset = document.getElementById('newChat');
  if (reset) reset.disabled = !view.chat.length || view.chatBusy;
}

// Opens the chat with a context and a prefilled question; nothing is sent automatically.
export function discuss(context, question) {
  if (!ctx.apiKey.get()) return alert('Сначала укажите API Key: Профиль → Настройки.');
  if (view.chatBusy) return go('chat');
  if (view.chat.length && !saveChat() || !applied(ctx.chats.start())) return;
  Object.assign(view, { chat: [], chatContext: context, chatPrefill: question });
  go('chat');
}

async function ask(question, retry = false) {
  const before = structuredClone(view.chat);
  if (retry) {
    const index = view.chat.findLastIndex(m => m.role === 'user'), message = view.chat[index];
    if (!message || !(message.pending || message.err)) return;
    view.chat = view.chat.slice(0, index + 1);
    delete message.err;
    message.pending = true;
  } else {
    view.chat.forEach(m => { if (m.pending) { m.err = true; delete m.pending; } });
    view.chat.push({ role: 'user', text: question, pending: true });
  }
  const message = view.chat.at(-1);
  if (!saveChat()) { view.chat = before; return; }
  view.chatPrefill = '';
  const field = document.querySelector('#chatForm textarea');
  if (field) { field.value = ''; resizeQuestion(field); }
  view.chatBusy = true;
  drawChat();
  try {
    const answer = await ctx.uc.askCoach(view.chat.filter(m => !m.err), view.chatContext);
    view.chat.push({ role: 'model', text: answer.text, model: answer.model, proposals: answer.proposals.map(p => ({ ...p, id: uid() })) });
  } catch (e) {
    message.err = true;
    view.chat.push({ role: 'model', text: 'Ошибка: ' + e.message + ' Записи тренировок это не затрагивает.', err: true });
  }
  delete message.pending;
  saveChat();
  view.chatBusy = false;
  drawChat();
}

const isQuestion = el => el.name === 'q' && el.form?.id === 'chatForm';

export const actions = {
  agreements: () => { view.modal = { type: 'agreements' }; ctx.render(); },
  chatHistory: () => { if (!view.chatBusy) { view.modal = { type: 'chat-history' }; ctx.render(); } },
  openChatSession: ({ id }) => {
    if (view.chatBusy || view.chat.length && !saveChat() || !applied(ctx.chats.select(id))) return;
    restoreChat();
    view.modal = null;
    ctx.render();
  },
  deleteChatSession: async ({ id }) => {
    if (view.chatBusy || !await ds.confirm('Удалить диалог?', 'Переписку нельзя будет восстановить.', { ok: 'Удалить', destructive: true })) return;
    if (view.chatBusy) return;
    const activeId = ctx.chats.active?.id;
    if (!applied(ctx.chats.remove(id))) return;
    if (id === activeId) restoreChat();
    ctx.render();
  },
  clearChatHistory: async () => {
    if (view.chatBusy || !await ds.confirm('Удалить всю историю?', 'Все диалоги будут удалены. Факты профиля и договорённости сохранятся.', { ok: 'Удалить', destructive: true })) return;
    if (view.chatBusy || !applied(ctx.chats.clear())) return;
    restoreChat();
    ctx.render();
  },
  retryChat: () => { if (!view.chatBusy) ask(null, true); },
  acceptCoachProposal: ({ message, proposal }) => {
    const p = view.chat[Number(message)]?.proposals?.[Number(proposal)];
    if (!p || proposalAccepted(p) || !saveChat()) return;
    if (applied(ctx.uc.acceptProposal(p))) { p.accepted = true; saveChat(); drawChat(); }
  },
  closeCoachAgreement: ({ id, status }) => { if (applied(ctx.uc.closeAgreement(id, status))) ctx.render(); },
  newChat: () => {
    if (view.chatBusy || view.chat.length && !saveChat() || !applied(ctx.chats.start())) return;
    restoreChat();
    ctx.render();
  },
  clearChatContext: () => {
    if (view.chatBusy || view.chat.length && !applied(ctx.chats.save(view.chat, null))) return;
    view.chatContext = null;
    ctx.render();
  },
};

export const listeners = [
  ['submit', ev => {
    if (ev.target.id !== 'chatForm') return;
    ev.preventDefault();
    const question = ev.target.q.value.trim();
    if (!question || view.chatBusy) return;
    ask(question);
  }],
  ['input', ev => {
    if (isQuestion(ev.target)) { view.chatPrefill = ev.target.value; resizeQuestion(ev.target); }
  }],
  ['keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey && isQuestion(ev.target)) { ev.preventDefault(); ev.target.form.requestSubmit(); }
  }],
];
