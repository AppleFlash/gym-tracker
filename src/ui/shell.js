// App shell: tab bar, navigation bar, current screen and the open sheet. render() redraws all of it.
import { DAYS, findVariant } from '../domain/program.js';
import { view, data, route } from './context.js';
import { esc, chevron, plusIcon } from './format.js';
import { parentRoute, routeTitle, tabOf } from './router.js';
import { workoutsPage, dayPage, animateDayProgress } from './screens/workouts.js';
import { exercisePage } from './screens/exercise.js';
import { weightsPage } from './screens/weights.js';
import { chatPage, drawChat } from './screens/chat.js';
import { morePage, dataPage, historyPage } from './screens/more.js';
import { catalogHtml, catalogDepth } from './sheets/catalog.js';
import { editSheetHtml } from './sheets/edit.js';

const TABS = [
  ['day', 'Тренировки', '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>'],
  ['weights', 'Веса', '<path d="M4 19V10M10 19V5M16 19v-7M22 19H2"/>'],
  ['chat', 'Чат', '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'],
  ['more', 'Ещё', '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'],
];

function tabBarHtml() {
  const current = tabOf(data().tab);
  return TABS.map(([id, name, icon]) => {
    const on = id === current;
    const dot = id === 'day' && data().today && !on ? '<span class="dot" aria-label="Есть тренировка на сегодня"></span>' : '';
    return `<button class="tab ${on ? 'active' : ''}" data-action="tab" data-id="${id}" aria-current="${on ? 'page' : 'false'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>${name}${dot}</button>`;
  }).join('');
}

function navBarHtml(r) {
  const p = parentRoute(r);
  const back = p ? `<button class="nav-back" data-action="workoutBack" aria-label="Назад: ${esc(routeTitle(p))}">${chevron}<span>${esc(routeTitle(p))}</span></button>` : '';
  const action = r.tab === 'weights' ? '<button class="nav-action" data-action="openCatalog" aria-label="База упражнений">База</button>'
    : !DAYS.includes(r.tab) ? ''
    : r.id ? `<button class="nav-action" data-action="editDayExercise" data-day="${r.tab}" data-id="${esc(r.id)}">Изменить</button>`
    : `<button class="nav-action" data-action="addDayExercise" data-day="${r.tab}" aria-label="Добавить упражнение">${plusIcon}</button>`;
  return `<div class="navbar"><div class="navbar-bar"><div class="nav-side">${back}</div><div class="nav-title">${r.tab === 'chat' ? 'Чат' : ''}</div><div class="nav-side end">${action}</div></div></div>`;
}

function pageHtml({ tab, id }) {
  if (tab === 'workouts') return workoutsPage();
  if (DAYS.includes(tab)) { const exercise = id && findVariant(data(), tab, id); return exercise ? exercisePage(tab, exercise) : dayPage(tab); }
  return ({ weights: weightsPage, chat: chatPage, data: dataPage, history: historyPage }[tab] || morePage)();
}

// Full screen markup for any route; also used for the swipe-back preview of the parent screen.
export const screenHtml = r => navBarHtml(r) + `<div class="screen-body">${pageHtml(r)}</div>`;

const sheetHtml = () => !view.modal ? '' : view.modal.type === 'catalog' ? catalogHtml() : editSheetHtml();

export function render() {
  const app = document.getElementById('app'), r = route();
  document.getElementById('nav').innerHTML = tabBarHtml();
  document.body.classList.toggle('chat-mode', r.tab === 'chat');
  const openSheet = app.querySelector('dialog.modal[open]'), toggles = ds.captureToggles(app);
  if (openSheet && !view.modal) ds.sheetClosed(openSheet);
  // Moving deeper inside the catalog pushes, going back pops; other sheet changes are instant.
  const depth = view.modal?.type === 'catalog' ? catalogDepth(view.modal) : 0;
  const sheetDir = openSheet && view.modal ? Math.sign(depth - view.sheetDepth) : 0, sheetSnap = sheetDir ? ds.sheetLayer(openSheet) : null;
  view.sheetDepth = depth;
  app.innerHTML = sheetHtml() + screenHtml(r);
  document.body.classList.toggle('sheet-open', !!view.modal);
  if (r.tab === 'chat') drawChat();
  const dialog = app.querySelector('dialog.modal');
  if (dialog) { dialog.showModal(); ds.sheetOpened(dialog, !!openSheet); ds.sheetSlide(dialog, sheetSnap, sheetDir); }
  ds.playToggles(app, toggles);
  ds.syncNavbar();
  if (DAYS.includes(r.tab) && !r.id) animateDayProgress(r.tab);
}
