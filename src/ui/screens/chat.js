// AI coach chat. The conversation lives only on screen. A visible context (one workout or one exercise) narrows
// what the coach is told; the user always sends the question themselves.
import { ctx, view, data, applied } from '../context.js';
import { esc, markdown } from '../format.js';
import { go } from '../router.js';

const messagesHtml = () => (view.chat.map((m, mi) => `<div class="msg ${m.role}">${m.role === 'model' ? markdown(m.text) : esc(m.text)}${(m.proposals || []).map((p, pi) => proposalHtml(p, mi, pi)).join('')}${m.model ? `<div class="msg-meta">${esc(m.model)}</div>` : ''}</div>`).join('')
  + (view.chatBusy ? '<div class="msg model typing">Думаю…</div>' : '')) || '<p class="note">Например: «Как прошла последняя тренировка?»</p>';

export function chatPage() {
  const context = view.chatContext, prefill = view.chatPrefill;
  view.chatPrefill = '';
  return `<div class="chat-page"><div class="chat-top">${context ? `<div class="chat-context"><span>Контекст: ${esc(context.label)}</span><button type="button" class="icon-btn" data-action="clearChatContext" aria-label="Убрать контекст">✕</button></div>` : ''}<button class="btn small" data-action="agreements">Договорённости</button><button class="btn small" id="newChat" data-action="newChat" ${view.chat.length && !view.chatBusy ? '' : 'disabled'}>+ Новый диалог</button></div><div id="chatlog" class="chatlog">${messagesHtml()}</div><form id="chatForm" class="chat-box"><textarea name="q" rows="1" placeholder="Вопрос о тренировках…" aria-label="Вопрос">${esc(prefill)}</textarea><div class="chat-bar"><span></span><button class="btn primary small" id="chatSend" aria-label="Отправить" ${view.chatBusy ? 'disabled' : ''}>→</button></div></form></div>`;
}

const scopeLabel = scope => scope.kind === 'program' ? 'Вся программа' : scope.kind === 'day' ? 'День ' + (scope.day === 'star' ? '★' : scope.day) : data().groups.flatMap(g => g.items).find(i => i.id === scope.weightId)?.name || 'Упражнение';
function proposalHtml(p, message, proposal) {
  const replaced = p.replaces && data().agreements.find(a => a.id === p.replaces);
  return `<section class="coach-proposal"><strong>${p.type === 'profile' ? 'Факт для профиля' : 'Предложение договорённости'}</strong><p>${esc(p.text)}</p>${p.type === 'agreement' ? `<p class="note">${esc(scopeLabel(p.scope))}. Оценка: ${esc(p.review.text)}${p.review.afterRuns ? ` · после ${p.review.afterRuns} выполнений` : ''}</p>${p.baselineWorkoutId ? `<p class="note">Исходное занятие: ${esc(data().workouts.find(w => w.id === p.baselineWorkoutId)?.date || p.baselineWorkoutId)}</p>` : ''}${replaced ? `<p class="note">Заменяет: ${esc(replaced.text)}</p>` : ''}` : ''}<button class="btn small" data-action="acceptCoachProposal" data-message="${message}" data-proposal="${proposal}" ${p.accepted ? 'disabled' : ''}>${p.accepted ? 'Сохранено' : p.type === 'profile' ? 'Сохранить в профиль' : 'Принять'}</button></section>`;
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
  const reset = document.getElementById('newChat');
  if (reset) reset.disabled = !view.chat.length || view.chatBusy;
}

// Opens the chat with a context and a prefilled question; nothing is sent automatically.
export function discuss(context, question) {
  if (view.chatBusy) return go('chat');
  Object.assign(view, { chat: [], chatContext: context, chatPrefill: question });
  go('chat');
}

async function ask(question) {
  const message = { role: 'user', text: question };
  view.chat.push(message);
  view.chatBusy = true;
  drawChat();
  try {
    const answer = await ctx.uc.askCoach(view.chat.filter(m => !m.err), view.chatContext);
    view.chat.push({ role: 'model', text: answer.text, model: answer.model, proposals: answer.proposals });
  } catch (e) {
    message.err = true;
    view.chat.push({ role: 'model', text: 'Ошибка: ' + e.message + ' Записи тренировок это не затрагивает.', err: true });
  }
  view.chatBusy = false;
  drawChat();
}

const isQuestion = el => el.name === 'q' && el.form?.id === 'chatForm';

export const actions = {
  agreements: () => { view.modal = { type: 'agreements' }; ctx.render(); },
  acceptCoachProposal: ({ message, proposal }) => {
    const p = view.chat[Number(message)]?.proposals?.[Number(proposal)];
    if (!p || p.accepted) return;
    if (applied(ctx.uc.acceptProposal(p))) { p.accepted = true; drawChat(); }
  },
  closeCoachAgreement: ({ id, status }) => { if (applied(ctx.uc.closeAgreement(id, status))) ctx.render(); },
  newChat: () => { if (!view.chatBusy) { view.chat = []; view.chatContext = null; ctx.render(); } },
  clearChatContext: () => { if (!view.chatBusy) { view.chatContext = null; ctx.render(); } },
};

export const listeners = [
  ['submit', ev => {
    if (ev.target.id !== 'chatForm') return;
    ev.preventDefault();
    const field = ev.target.q, question = field.value.trim();
    if (!question || view.chatBusy) return;
    field.value = '';
    resizeQuestion(field);
    ask(question);
  }],
  ['input', ev => {
    if (isQuestion(ev.target)) resizeQuestion(ev.target);
  }],
  ['keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey && isQuestion(ev.target)) { ev.preventDefault(); ev.target.form.requestSubmit(); }
  }],
];
