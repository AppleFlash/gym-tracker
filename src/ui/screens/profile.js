// Profile: four tiles leading to progress, workout history, all exercises and settings.
import { catalogItems } from '../../domain/catalog.js';
import { progressList, historyNewestFirst, performancesOf, representativeSet } from '../../domain/workout.js';
import { ctx, view, data, applied, rerender } from '../context.js';
import { esc, shortDate, longDate, setText, plural } from '../format.js';
import { go } from '../router.js';
import { historyChartPage } from './history.js';
import { catalogBrowser } from '../catalog-list.js';

const EXERCISES_WITH_HISTORY = ['упражнение', 'упражнения', 'упражнений'];

export function profilePage() {
  const progress = progressList(data()).length, last = historyNewestFirst(data())[0], goal = data().profile.goal.trim();
  const tile = (id, title, value) => `<button class="tile" data-action="tab" data-id="${id}"><strong>${title}</strong><span>${value}</span></button>`;
  return `<h1>Профиль</h1><div class="tiles">
    ${tile('progress', 'Прогресс', progress ? plural(progress, EXERCISES_WITH_HISTORY) + ' с историей' : 'Пока нет данных')}
    ${tile('history', 'История', last ? 'Последняя ' + esc(shortDate(last.date)) : 'Пока нет тренировок')}
    ${tile('exercises', 'Все упражнения', plural(catalogItems(data()).filter(i => !i.archived).length, EXERCISES_WITH_HISTORY) + ' в базе')}
    ${tile('settings', 'Настройки', goal ? esc(goal.length > 60 ? goal.slice(0, 57) + '…' : goal) : 'Цель не задана')}
  </div>`;
}

export function progressPage() {
  const rows = progressList(data()).sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return '<h1>Прогресс</h1><div class="empty">Здесь появятся упражнения после первой завершённой тренировки с подходами.</div>';
  return `<h1>Прогресс</h1><section class="card list">${rows.map(r => {
    const weights = performancesOf(data(), r.item.id).slice(-6).map(p => representativeSet(p.sets).weight);
    return `<button class="list-row progress-row" data-action="openItem" data-id="${esc(r.item.id)}" data-from="progress"><span class="progress-name"><strong>${esc(r.item.name)}</strong><small>${r.previous ? `${setText(r.last)} ← ${setText(r.previous)}` : `${setText(r.last)} · недостаточно данных для сравнения`}</small></span>${weights.length > 1 ? ds.sparkline(weights) : ''}<span class="row-chevron" aria-hidden="true">›</span></button>`;
  }).join('')}</section><p class="note">Основной подход последнего занятия ← предыдущего.</p>`;
}

export function historyPage() {
  return historyChartPage();
}

export const exercisesPage = () => `<h1>Все упражнения</h1>${catalogBrowser('page')}`;

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/></svg>';

function apiKeyCard() {
  const key = ctx.apiKey.get(), editing = !key || view.keyEditing;
  const row = editing
    ? `<form class="key-row" data-key-form><div class="field"><input type="password" name="key" placeholder="Вставьте ключ DeepSeek" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="API Key"></div><button class="btn primary" aria-label="Сохранить ключ">${ARROW}</button></form>`
    : `<div class="key-row"><div class="field"><input readonly value="${esc(key.slice(0, Math.min(6, key.length >> 1)) + '********')}" aria-label="API Key"></div><button class="btn" data-action="editApiKey" aria-label="Изменить ключ">${PENCIL}</button></div>`;
  return `<section class="card"><h2>API Key</h2>${row}<div class="footer-actions"><button class="btn danger" data-action="removeApiKey" ${key ? '' : 'disabled'}>Удалить</button></div></section>`;
}

export function settingsPage() {
  const p = data().profile;
  return `<h1>Настройки</h1>
    ${apiKeyCard()}
    <section class="card"><h2>Для ИИ-тренера</h2>
      <label class="field wide">Цель тренировок<textarea id="profileGoal" data-profile-field="goal" rows="2" placeholder="Например: сила в базовых упражнениях">${esc(p.goal)}</textarea></label>
      <label class="field wide">Дополнительный контекст<textarea data-profile-field="context" rows="4" placeholder="Опыт, ограничения, травмы, оборудование…">${esc(p.context)}</textarea></label>
      <p class="note">Цель и контекст сохраняются автоматически. ИИ получает эти сведения вместе с относящимися к вопросу тренировками через DeepSeek.</p>
      <h3>Подтверждённые факты</h3>
      ${p.facts.length ? p.facts.map(f => `<form class="coach-fact" data-fact-form="${esc(f.id)}"><label class="field wide">Факт<textarea name="text" maxlength="1200" rows="2" required>${esc(f.text)}</textarea></label><div class="footer-actions"><button class="btn small">Сохранить</button><button type="button" class="btn small danger" data-action="removeCoachFact" data-id="${esc(f.id)}">Удалить</button></div></form>`).join('') : '<p class="note">Сведения из разговора появятся здесь после вашего подтверждения.</p>'}</section>
    <section class="card"><h2>Данные</h2><p class="note">Тренировки и история хранятся только на этом устройстве. Экспорт сохраняет JSON-копию; импорт заменяет текущие данные содержимым файла.</p>
      <div class="footer-actions"><button class="btn" data-action="export">Экспорт JSON</button><button class="btn" data-action="import">Импорт JSON</button></div>
      <p class="note">Последний экспорт: ${p.lastExportAt ? esc(longDate(p.lastExportAt.slice(0, 10))) : 'ещё не выполнялся'}. Приложение не проверяет, сохранился ли скачанный файл.</p></section>`;
}

function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


export const actions = {
  editApiKey: () => { view.keyEditing = true; rerender(); },
  removeApiKey: () => { ctx.apiKey.clear(); view.keyEditing = false; rerender(); },
  removeCoachFact: ({ id }) => { if (applied(ctx.uc.removeFact(id))) ctx.render(); },
  export: () => {
    const text = ctx.uc.exportBackup();
    if (!text) return alert('Не удалось сохранить дату экспорта. Освободите место и попробуйте снова.');
    download(text, 'gym-backup-' + new Date().toISOString().slice(0, 10) + '.json');
    ctx.render();
  },
  import: () => document.getElementById('importFile').click(),
};

export const listeners = [
  ['submit', ev => {
    if (ev.target.dataset.keyForm !== undefined) {
      ev.preventDefault();
      const key = ev.target.elements.key.value.trim();
      if (!key) return;
      if (!ctx.apiKey.set(key)) return alert('Не удалось сохранить ключ в браузере.');
      view.keyEditing = false;
      return rerender();
    }
    const id = ev.target.dataset.factForm;
    if (!id) return;
    ev.preventDefault();
    if (applied(ctx.uc.editFact(id, ev.target.elements.text.value))) ctx.render();
  }],
  ['input', ev => {
    if (ev.target.dataset.profileField) { const result = ctx.uc.setProfileText(ev.target.dataset.profileField, ev.target.value); if (result?.error) alert(result.error); }
  }],
  ['change', async ev => {
    if (ev.target.id !== 'importFile') return;
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const backup = ctx.uc.readBackup(await file.text());
      if (confirm('Заменить текущие данные импортированной копией?') && applied(ctx.uc.replaceData(backup))) {
        Object.assign(view, { exerciseId: null, modal: null, draft: null });
        go('workouts');
      }
    } catch (e) { alert('Импорт не удался: ' + e.message); }
    ev.target.value = '';
  }],
];
