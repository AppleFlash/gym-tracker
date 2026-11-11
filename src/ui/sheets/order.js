// "Exercises of this workout" sheet: plain names, drag to reorder, tap a name to jump to its card.
// The order is the program's order of the day (the workout follows it). State: view.modal = {type: 'exercise-order', day}.
import { ctx, view, data, applied, rerender } from '../context.js';
import { sortableList } from '../components/sortable-list.js';
import { advanceCarousel, carouselPosition, setCarouselPosition } from '../components/carousel.js';
import { dayEntries } from '../screens/workout.js';

export function orderHtml() {
  const items = dayEntries(view.modal.day).map(e => ({ id: e.id, label: e.name }));
  if (!items.length) return '';
  return `<dialog class="modal technique-modal" aria-labelledby="orderTitle"><section class="card catalog-shell technique-shell"><div class="catalog-content technique-content"><h2 class="technique-title" id="orderTitle">Упражнения тренировки</h2>${sortableList({ id: 'exercise-order', items, pick: 'pickExercise' })}</div><footer class="sheet-footer"><button class="btn" data-action="close">Закрыть</button></footer></section></dialog>`;
}

export const actions = {
  openOrder: ({ day }) => { view.modal = { type: 'exercise-order', day }; ctx.render(); },
  pickExercise: ({ id }) => {
    const index = dayEntries(view.modal?.day).findIndex(e => e.id === id);
    if (index < 0) return;
    advanceCarousel(index);
    view.modal = null;
    rerender();
  },
};

export const listeners = [['sortchange', ev => {
  const { list, from, to } = ev.detail, m = view.modal;
  if (list !== 'exercise-order' || m?.type !== 'exercise-order') return;
  const slots = dayEntries(m.day), current = slots[carouselPosition()]?.id, ids = (data().days[m.day] || []).map(e => e.id);
  const f = ids.indexOf(slots[from]?.id), t = ids.indexOf(slots[to]?.id);
  if (f < 0 || t < 0 || !applied(ctx.uc.moveExercise(m.day, f, t))) return ctx.render();
  setCarouselPosition(dayEntries(m.day).findIndex(s => s.id === current)); // the open card stays the same exercise
  rerender();
}]];
