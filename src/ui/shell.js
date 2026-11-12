// App shell: tab bar, navigation bar, current screen and the open sheet. render() redraws all of it.
import { DAYS, slotOf } from '../domain/program.js';
import { activeWorkouts, activeWorkoutOf, findSlot } from '../domain/workout.js';
import { view, data, route } from './context.js';
import { esc, chevron, plusIcon, moreIcon } from './format.js';
import { parentRoute, routeTitle, tabOf } from './router.js';
import { homePage } from './screens/home.js';
import { workoutPage, exerciseMenuHtml } from './screens/workout.js';
import { exercisePage, itemPage } from './screens/exercise.js';
import { resultPage } from './screens/result.js';
import { historyDetailPage } from './screens/history.js';
import { chatPage, drawChat, agreementsHtml } from './screens/chat.js';
import { profilePage, progressPage, historyPage, exercisesPage, settingsPage } from './screens/profile.js';
import { catalogHtml, catalogDepth } from './sheets/catalog.js';
import { variantsHtml } from './sheets/variants.js';
import { techniqueHtml, alternativeHtml } from './sheets/catalog-ai.js';
import { editSheetHtml } from './sheets/edit.js';
import { orderHtml } from './sheets/order.js';
import { noteHtml } from './sheets/note.js';
import { restoreCarousel } from './components/carousel.js';

const TABS = [
  ['day', 'Тренировки', '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>'],
  ['chat', 'Чат', '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'],
  ['profile', 'Профиль', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'],
];

function tabBarHtml() {
  const current = tabOf(data().tab), running = activeWorkouts(data()).length > 0;
  return TABS.map(([id, name, icon]) => {
    const on = id === current;
    const dot = id === 'day' && running && !on ? '<span class="dot" aria-label="Идёт тренировка"></span>' : '';
    return `<button class="tab ${on ? 'active' : ''}" data-action="tab" data-id="${id}" aria-current="${on ? 'page' : 'false'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>${name}${dot}</button>`;
  }).join('');
}

function navAction(r) {
  if (!DAYS.includes(r.tab)) return '';
  const workout = activeWorkoutOf(data(), r.tab);
  if (r.id) return '';
  const add = `<button class="nav-action" data-action="addDayExercise" data-day="${r.tab}" aria-label="Добавить упражнение">${plusIcon}</button>`;
  return workout ? `<button class="nav-action" data-action="workoutMenu" data-id="${esc(workout.id)}" aria-label="Действия с занятием">${moreIcon}</button>${add}` : add;
}

function navBarHtml(r) {
  const p = parentRoute(r);
  const back = p ? `<button class="nav-back" data-action="workoutBack" aria-label="Назад: ${esc(routeTitle(p))}">${chevron}<span>Назад</span></button>` : '';
  return `<div class="navbar"><div class="navbar-bar"><div class="nav-side">${back}</div><div class="nav-title">${r.tab === 'chat' ? 'Чат' : ''}</div><div class="nav-side end">${navAction(r)}</div></div></div>`;
}

const PAGES = { workouts: homePage, chat: chatPage, profile: profilePage, progress: progressPage, history: historyPage, 'history-detail': historyDetailPage, exercises: exercisesPage, settings: settingsPage };

function pageHtml({ tab, id }) {
  if (DAYS.includes(tab)) {
    const known = id && (findSlot(activeWorkoutOf(data(), tab), id) || slotOf(data(), tab, id));
    return known ? exercisePage(tab, id) : workoutPage(tab);
  }
  if (tab === 'result' && id) return resultPage(id);
  if (tab === 'item' && id) return itemPage(id);
  return (PAGES[tab] || homePage)();
}

// Full screen markup for any route; also used for the swipe-back preview of the parent screen.
export const screenHtml = r => navBarHtml(r) + `<div class="screen-body">${pageHtml(r)}</div>`;

const SHEETS = { agreements: agreementsHtml, catalog: catalogHtml, variants: variantsHtml, technique: techniqueHtml, 'alternative-ai': alternativeHtml, 'exercise-menu': exerciseMenuHtml, 'exercise-order': orderHtml, note: noteHtml };
const sheetHtml = () => !view.modal ? '' : (SHEETS[view.modal.type] || editSheetHtml)();

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
  restoreCarousel();
  if (r.tab === 'chat') drawChat();
  const dialog = app.querySelector('dialog.modal');
  if (dialog) { dialog.showModal(); ds.sheetOpened(dialog, !!openSheet); ds.sheetSlide(dialog, sheetSnap, sheetDir); }
  ds.playToggles(app, toggles);
  ds.syncNavbar();
}
