// Navigation between screens. A route is {tab, id}. Tabs: workouts, chat, profile; deeper screens push.
//   workouts → A|B|C|star (workout) → slot id (exercise);   workouts → result (right after finishing)
//   profile → progress|history|exercises|settings;   history → history-detail → result;   progress|exercises → item
// Drilling deeper inside one tab pushes, going up pops; switching tabs is instant.
import { DAYS } from '../domain/program.js';
import { ctx, view, data, route } from './context.js';
import { dayTitle } from './format.js';

const PROFILE_PAGES = ['progress', 'history', 'history-detail', 'exercises', 'settings'];
export const routeKey = r => r.tab + ':' + (r.id || '');

export function tabOf(tab) {
  if (tab === 'workouts' || DAYS.includes(tab)) return 'day';
  if (tab === 'result') return view.resultFrom === 'workouts' ? 'day' : 'profile';
  return tab === 'profile' || tab === 'item' || PROFILE_PAGES.includes(tab) ? 'profile' : tab;
}

export function parentRoute(r = route()) {
  if (DAYS.includes(r.tab)) return { tab: r.id ? r.tab : 'workouts', id: null };
  if (r.tab === 'result') return { tab: view.resultFrom === 'workouts' ? 'workouts' : 'history-detail', id: null };
  if (r.tab === 'item') return { tab: view.itemParent, id: null };
  if (r.tab === 'history-detail') return { tab: 'history', id: null };
  if (PROFILE_PAGES.includes(r.tab)) return { tab: 'profile', id: null };
  return null;
}
const depthOf = r => { let depth = 0; for (let p = parentRoute(r); p; p = parentRoute(p)) depth++; return depth; };

const TITLES = { workouts: 'Тренировки', profile: 'Профиль', progress: 'Прогресс', history: 'История', 'history-detail': 'Подробная история', exercises: 'Все упражнения' };
export const routeTitle = r => TITLES[r.tab] || (DAYS.includes(r.tab) ? dayTitle(r.tab) : '');

export function go(tab, id = null, animate = true) {
  const from = route(), to = { tab, id };
  const dir = tabOf(tab) === tabOf(from.tab) ? Math.sign(depthOf(to) - depthOf(from)) : 0;
  ds.go(dir, () => {
    data().tab = tab;
    view.exerciseId = id;
    view.modal = null;
    ctx.store.persist();
    ctx.render();
  }, { from: routeKey(from), to: routeKey(to), animate });
}

export const goBack = () => { const p = parentRoute(); if (p) go(p.tab, p.id); };
