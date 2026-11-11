// Controller entry: one delegated click handler routes data-action to the feature that owns it.
import { view } from './context.js';
import { go, goBack, parentRoute, routeKey } from './router.js';
import { screenHtml } from './shell.js';
import * as home from './screens/home.js';
import * as workout from './screens/workout.js';
import * as exercise from './screens/exercise.js';
import * as result from './screens/result.js';
import * as chat from './screens/chat.js';
import * as profile from './screens/profile.js';
import * as history from './screens/history.js';
import * as sets from './sets.js';
import * as catalog from './sheets/catalog.js';
import * as catalogList from './catalog-list.js';
import * as catalogAi from './sheets/catalog-ai.js';
import * as variants from './sheets/variants.js';
import * as edit from './sheets/edit.js';
import * as reorder from './reorder.js';
import * as carousel from './components/carousel.js';
import * as segments from './components/segment-progress.js';
import * as exerciseCard from './components/exercise-card.js';
import * as sortable from './components/sortable-list.js';
import * as order from './sheets/order.js';

const features = [home, workout, exercise, result, chat, profile, history, sets, catalog, catalogList, catalogAi, variants, edit, reorder, carousel, segments, exerciseCard, sortable, order];

const shellActions = {
  tab: ({ id }) => go(id === 'day' ? 'workouts' : id),
  workoutBack: goBack,
};

export function bindEvents() {
  const actions = Object.assign({}, shellActions, ...features.map(f => f.actions || {}));
  const duplicate = features.flatMap(f => Object.keys(f.actions || {})).find((name, i, all) => all.indexOf(name) !== i);
  if (duplicate) throw Error('Duplicate UI action: ' + duplicate);

  document.addEventListener('click', ev => {
    if (ev.target.matches('dialog.modal')) return edit.closeSheet(); // backdrop tap
    const el = ev.target.closest('[data-action]');
    if (el) actions[el.dataset.action]?.(el.dataset, el, ev);
  });
  // Keyboard activation for non-button elements acting as buttons.
  document.addEventListener('keydown', ev => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[role=button][data-action]')) { ev.preventDefault(); ev.target.click(); }
  });
  // Escape on a sheet.
  document.addEventListener('cancel', ev => { if (ev.target.matches('dialog.modal')) { ev.preventDefault(); edit.closeSheet(); } }, true);
  for (const feature of features) for (const [type, handler, options] of feature.listeners || []) document.addEventListener(type, handler, options);

  ds.onDismiss = edit.closeSheet;
  ds.swipe({
    parent: () => view.modal ? null : parentRoute(),
    html: screenHtml,
    key: routeKey,
    commit: r => go(r.tab, r.id, false),
  });
}
