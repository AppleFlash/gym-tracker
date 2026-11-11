// "Exercises of this workout" sheet: plain names, drag to reorder, tap a name to jump to its card.
// The order is the program's order of the day (the workout follows it). State: view.modal = {type: 'exercise-order', day}.
import { activeWorkoutOf, selectedVariant } from '../../domain/workout.js';
import { ctx, view, data, applied, rerender } from '../context.js';
import { sortableList } from '../components/sortable-list.js';
import { advanceCarousel, carouselPosition, setCarouselPosition } from '../components/carousel.js';
import { orderedSlots } from '../screens/workout.js';

export function orderHtml() {
  const workout = activeWorkoutOf(data(), view.modal.day);
  if (!workout) return '';
  const items = orderedSlots(workout).map(slot => ({ id: slot.id, label: selectedVariant(slot).name }));
  return `<dialog class="modal technique-modal" aria-labelledby="orderTitle"><section class="card catalog-shell technique-shell"><div class="catalog-content technique-content"><h2 class="technique-title" id="orderTitle">Упражнения тренировки</h2>${sortableList({ id: 'exercise-order', items, pick: 'pickExercise' })}</div><footer class="sheet-footer"><button class="btn" data-action="close">Закрыть</button></footer></section></dialog>`;
}

export const actions = {
  openOrder: ({ day }) => { view.modal = { type: 'exercise-order', day }; ctx.render(); },
  pickExercise: ({ id }) => {
    const workout = activeWorkoutOf(data(), view.modal?.day), index = workout ? orderedSlots(workout).findIndex(s => s.id === id) : -1;
    if (index < 0) return;
    advanceCarousel(index);
    view.modal = null;
    rerender();
  },
};

export const listeners = [['sortchange', ev => {
  const { list, from, to } = ev.detail, m = view.modal, workout = list === 'exercise-order' && activeWorkoutOf(data(), m?.day);
  if (!workout) return;
  const slots = orderedSlots(workout), current = slots[carouselPosition()]?.id, ids = (data().days[m.day] || []).map(e => e.id);
  const f = ids.indexOf(slots[from]?.id), t = ids.indexOf(slots[to]?.id);
  if (f < 0 || t < 0 || !applied(ctx.uc.moveExercise(m.day, f, t))) return ctx.render();
  setCarouselPosition(orderedSlots(activeWorkoutOf(data(), m.day)).findIndex(s => s.id === current)); // the open card stays the same exercise
  rerender();
}]];
