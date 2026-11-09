// AI coach chat. The conversation lives only on screen; the profile text is persisted.
import { ctx, view, data } from '../context.js';
import { esc, markdown } from '../format.js';

const messagesHtml = () => (view.chat.map(m => `<div class="msg ${m.role}">${m.role === 'model' ? markdown(m.text) : esc(m.text)}${m.model ? `<div class="msg-meta">${esc(m.model)}</div>` : ''}</div>`).join('')
  + (view.chatBusy ? '<div class="msg model typing">Думаю…</div>' : '')) || '<p class="note">Например: «Пора повышать вес в жиме лёжа?»</p>';

export const chatPage = () => `<div class="chat-page"><div class="chat-top"><details class="profile"><summary>Обо мне и цели</summary><textarea id="aiProfile" rows="4" placeholder="Возраст, рост, вес, опыт, цели, ограничения, травмы…">${esc(data().ai?.profile || '')}</textarea></details><button class="btn small" id="newChat" data-action="newChat" ${view.chat.length && !view.chatBusy ? '' : 'disabled'}>+ Новый диалог</button></div><div id="chatlog" class="chatlog">${messagesHtml()}</div><form id="chatForm" class="chat-box"><textarea name="q" rows="1" placeholder="Вопрос о тренировках…" aria-label="Вопрос"></textarea><div class="chat-bar"><span></span><button class="btn primary small" id="chatSend" aria-label="Отправить" ${view.chatBusy ? 'disabled' : ''}>→</button></div></form></div>`;

// Updates only the conversation, keeping the typed question and keyboard focus.
export function drawChat() {
  const log = document.getElementById('chatlog');
  if (log) { log.innerHTML = messagesHtml(); log.scrollTop = log.scrollHeight; }
  const send = document.getElementById('chatSend');
  if (send) send.disabled = view.chatBusy;
  const reset = document.getElementById('newChat');
  if (reset) reset.disabled = !view.chat.length || view.chatBusy;
}

async function ask(question) {
  const message = { role: 'user', text: question };
  view.chat.push(message);
  view.chatBusy = true;
  drawChat();
  try {
    const answer = await ctx.uc.askCoach(view.chat.filter(m => !m.err));
    view.chat.push({ role: 'model', text: answer.text, model: answer.model });
  } catch (e) {
    message.err = true;
    view.chat.push({ role: 'model', text: 'Ошибка: ' + e.message, err: true });
  }
  view.chatBusy = false;
  drawChat();
}

const isQuestion = el => el.name === 'q' && el.form?.id === 'chatForm';

export const actions = {
  newChat: () => { if (!view.chatBusy) { view.chat = []; drawChat(); } },
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
    const el = ev.target;
    if (el.id === 'aiProfile') ctx.uc.setProfile(el.value);
    if (isQuestion(el)) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }],
  ['keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey && isQuestion(ev.target)) { ev.preventDefault(); ev.target.form.requestSubmit(); }
  }],
];
