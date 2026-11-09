// Controller entry: one delegated click handler routes data-action to the feature that owns it.
import { view } from './context.js';
import { go, goBack, parentRoute, routeKey } from './router.js';
import { screenHtml } from './shell.js';
import * as workouts from './screens/workouts.js';
import * as exercise from './screens/exercise.js';
import * as weights from './screens/weights.js';
import * as chat from './screens/chat.js';
import * as more from './screens/more.js';
import * as catalog from './sheets/catalog.js';
import * as edit from './sheets/edit.js';
import * as reorder from './reorder.js';

const features = [workouts, exercise, weights, chat, more, catalog, edit, reorder];

const shellActions = {
  tab: ({ id }) => go(id === 'day' ? 'workouts' : id),
  workoutBack: goBack,
  chartRange: (dataset, el) => ds.setRange(el.closest('[data-chart]'), dataset.range),
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
