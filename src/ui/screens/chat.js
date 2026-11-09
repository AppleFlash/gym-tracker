// AI coach chat. The conversation lives only on screen. A visible context (one workout or one exercise) narrows
// what the coach is told; the user always sends the question themselves.
import { ctx, view } from '../context.js';
import { esc, markdown } from '../format.js';
import { go } from '../router.js';

const messagesHtml = () => (view.chat.map(m => `<div class="msg ${m.role}">${m.role === 'model' ? markdown(m.text) : esc(m.text)}${m.model ? `<div class="msg-meta">${esc(m.model)}</div>` : ''}</div>`).join('')
  + (view.chatBusy ? '<div class="msg model typing">Думаю…</div>' : '')) || '<p class="note">Например: «Как прошла последняя тренировка?»</p>';

export function chatPage() {
  const context = view.chatContext, prefill = view.chatPrefill;
  view.chatPrefill = '';
  return `<div class="chat-page"><div class="chat-top">${context ? `<div class="chat-context"><span>Контекст: ${esc(context.label)}</span><button type="button" class="icon-btn" data-action="clearChatContext" aria-label="Убрать контекст">✕</button></div>` : '<span></span>'}<button class="btn small" id="newChat" data-action="newChat" ${view.chat.length && !view.chatBusy ? '' : 'disabled'}>+ Новый диалог</button></div><div id="chatlog" class="chatlog">${messagesHtml()}</div><form id="chatForm" class="chat-box"><textarea name="q" rows="${prefill ? 3 : 1}" placeholder="Вопрос о тренировках…" aria-label="Вопрос">${esc(prefill)}</textarea><div class="chat-bar"><span></span><button class="btn primary small" id="chatSend" aria-label="Отправить" ${view.chatBusy ? 'disabled' : ''}>→</button></div></form></div>`;
}

// Updates only the conversation, keeping the typed question and keyboard focus.
export function drawChat() {
  const log = document.getElementById('chatlog');
  if (log) { log.innerHTML = messagesHtml(); log.scrollTop = log.scrollHeight; }
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
    view.chat.push({ role: 'model', text: answer.text, model: answer.model });
  } catch (e) {
    message.err = true;
    view.chat.push({ role: 'model', text: 'Ошибка: ' + e.message + ' Записи тренировок это не затрагивает.', err: true });
  }
  view.chatBusy = false;
  drawChat();
}

const isQuestion = el => el.name === 'q' && el.form?.id === 'chatForm';

export const actions = {
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
    field.style.height = '';
    ask(question);
  }],
  ['input', ev => {
    if (isQuestion(ev.target)) { ev.target.style.height = 'auto'; ev.target.style.height = ev.target.scrollHeight + 'px'; }
  }],
  ['keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey && isQuestion(ev.target)) { ev.preventDefault(); ev.target.form.requestSubmit(); }
  }],
];
