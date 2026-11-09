// Navigation between screens. A route is {tab, id}: id is the open exercise inside a day tab.
// Drilling deeper inside one tab pushes, going up pops; switching tabs is instant.
import { DAYS } from '../domain/program.js';
import { ctx, view, data, route } from './context.js';
import { dayTitle } from './format.js';

export const routeKey = r => r.tab + ':' + (r.id || '');
export const tabOf = tab => tab === 'workouts' || DAYS.includes(tab) ? 'day' : ['more', 'data', 'history'].includes(tab) ? 'more' : tab;
const depthOf = r => DAYS.includes(r.tab) ? (r.id ? 2 : 1) : ['data', 'history'].includes(r.tab) ? 1 : 0;

export const parentRoute = (r = route()) => DAYS.includes(r.tab) ? { tab: r.id ? r.tab : 'workouts', id: null }
  : ['data', 'history'].includes(r.tab) ? { tab: 'more', id: null } : null;
export const routeTitle = r => r.tab === 'workouts' ? 'Тренировки' : r.tab === 'more' ? 'Ещё' : DAYS.includes(r.tab) ? dayTitle(r.tab) : '';

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
