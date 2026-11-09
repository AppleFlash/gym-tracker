// Profile: four tiles leading to progress, workout history, all exercises and settings.
import { catalogItems, groupDeleteError, findGroup } from '../../domain/catalog.js';
import { progressList, historyNewestFirst, performancesOf, representativeSet } from '../../domain/workout.js';
import { ctx, view, data, applied } from '../context.js';
import { esc, shortDate, longDate, setText, plural, trashIcon } from '../format.js';
import { go } from '../router.js';
import { historyRow } from './result.js';
import { openCatalog } from '../sheets/catalog.js';

const EXERCISES_WITH_HISTORY = ['упражнение', 'упражнения', 'упражнений'];

export function profilePage() {
  const progress = progressList(data()).length, last = historyNewestFirst(data())[0], goal = data().profile.goal.trim();
  const tile = (id, title, value) => `<button class="tile" data-action="tab" data-id="${id}"><strong>${title}</strong><span>${value}</span></button>`;
  return `<h1>Профиль</h1><div class="tiles">
    ${tile('progress', 'Прогресс', progress ? plural(progress, EXERCISES_WITH_HISTORY) + ' с историей' : 'Пока нет данных')}
    ${tile('history', 'История', last ? 'Последняя ' + esc(shortDate(last.date)) : 'Пока нет тренировок')}
    ${tile('exercises', 'Все упражнения', plural(catalogItems(data()).length, EXERCISES_WITH_HISTORY) + ' в базе')}
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
  const workouts = historyNewestFirst(data());
  return `<h1>История</h1>${workouts.length ? `<section class="card menu-list">${workouts.map(historyRow).join('')}</section>` : '<div class="empty">Здесь появятся завершённые тренировки.</div>'}`;
}

function exerciseRows(group, items) {
  return items.map(i => {
    const runs = performancesOf(data(), i.id).length;
    return `<button class="list-row" data-action="openItem" data-id="${esc(i.id)}" data-from="exercises"><span class="progress-name"><strong>${esc(i.name)}</strong><small>${runs ? plural(runs, ['занятие', 'занятия', 'занятий']) : 'Нет завершённых занятий'}${i.records.length ? ` · ${plural(i.records.length, ['старая запись', 'старые записи', 'старых записей'])}` : ''}</small></span><span class="row-chevron" aria-hidden="true">›</span></button>`;
  }).join('');
}

const groupsHtml = () => {
  const q = view.query.trim().toLowerCase(), has = s => s.toLowerCase().includes(q);
  return data().groups.map(g => {
    const items = !q || has(g.name) ? g.items : g.items.filter(i => has(i.name));
    if (q && !items.length) return '';
    return `<div class="w-group-head"><h2 class="group-title">${esc(g.name)}</h2><button class="icon-btn" data-action="deleteGroup" data-group="${esc(g.id)}" aria-label="Удалить группу «${esc(g.name)}»">${trashIcon}</button></div><section class="card list">${items.length ? exerciseRows(g, items) : '<p class="note w-empty">В группе пока нет упражнений.</p>'}</section>`;
  }).join('') || (q ? '<div class="empty">Ничего не найдено</div>' : '');
};

export const exercisesPage = () => `<h1>Все упражнения</h1><div class="search"><input type="search" id="wsearch" placeholder="Поиск по группам и упражнениям" value="${esc(view.query)}" autocomplete="off" aria-label="Поиск"><button type="button" class="search-x" data-action="clearSearch" aria-label="Очистить поиск" ${view.query ? '' : 'hidden'}>✕</button></div><div id="wlist">${groupsHtml()}</div>`;

export function settingsPage() {
  const p = data().profile;
  return `<h1>Настройки</h1>
    <section class="card"><h2>Для ИИ-тренера</h2>
      <label class="field wide">Цель тренировок<textarea id="profileGoal" data-profile-field="goal" rows="2" placeholder="Например: сила в базовых упражнениях">${esc(p.goal)}</textarea></label>
      <label class="field wide">Дополнительный контекст<textarea data-profile-field="context" rows="4" placeholder="Опыт, ограничения, травмы, оборудование…">${esc(p.context)}</textarea></label>
      <p class="note">Сохраняется автоматически. ИИ видит этот текст вместе с данными тренировок.</p></section>
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

const redrawList = () => { document.getElementById('wlist').innerHTML = groupsHtml(); };
let searchTimer;

export const actions = {
  openCatalog: () => openCatalog(),
  clearSearch: (_, el) => {
    const input = document.getElementById('wsearch');
    clearTimeout(searchTimer);
    view.query = input.value = '';
    el.hidden = true;
    redrawList();
    input.focus();
  },
  deleteGroup: ({ group }) => {
    const error = groupDeleteError(data(), group);
    if (error) return alert(error);
    if (confirm('Удалить группу «' + findGroup(data(), group).name + '»? Упражнения пропадут из базы; завершённая история тренировок сохранится.')) applied(ctx.uc.deleteGroup(group));
    ctx.render();
  },
  export: () => {
    const text = ctx.uc.exportBackup();
    if (!text) return alert('Не удалось сохранить дату экспорта. Освободите место и попробуйте снова.');
    download(text, 'gym-backup-' + new Date().toISOString().slice(0, 10) + '.json');
    ctx.render();
  },
  import: () => document.getElementById('importFile').click(),
};

export const listeners = [
  ['input', ev => {
    if (ev.target.dataset.profileField) ctx.uc.setProfileText(ev.target.dataset.profileField, ev.target.value);
    if (ev.target.id !== 'wsearch') return;
    const value = ev.target.value;
    document.querySelector('.search-x').hidden = !value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { view.query = value; redrawList(); }, 300);
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
