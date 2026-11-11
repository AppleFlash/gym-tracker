// Workout screen. Without an active workout: the template (slots, alternatives, plan) and "Start".
// During a workout: progress segments and a carousel with one card per slot (see ui/components).
import { variantsOf, slotOf } from '../../domain/program.js';
import { activeWorkouts, activeWorkoutOf, findSlot, selectedVariant, mainVariant, setsOf, slotStatus, workoutProgress, workoutSummary, lastPerformance, lastCompleted, draftRow, prefill, volumeOf, loadFactor } from '../../domain/workout.js';
import { ctx, view, data, applied, rerender } from '../context.js';
import { esc, nice, kg, dayTitle, dayLetter, shortDate, setsText, plural, EXERCISES } from '../format.js';
import { go } from '../router.js';
import { dumbbellHint } from '../sets.js';
import { segmentProgress } from '../components/segment-progress.js';
import { carousel, carouselIndex, advanceCarousel } from '../components/carousel.js';
import { exerciseCard, open as openCards } from '../components/exercise-card.js';
import { setEntry } from '../components/set-entry.js';
import { openCatalog } from '../sheets/catalog.js';
import { deleteWorkout } from './home.js';

const lastTimeText = (weightId, exceptId) => {
  const last = lastPerformance(data(), weightId, exceptId);
  return last ? `${esc(shortDate(last.workout.date))}: ${setsText(last.sets)}` : 'нет данных';
};
const handle = '<span class="drag-handle" title="Перетащить" aria-hidden="true">⠿</span>';

// Workout slots follow the current program order; slots no longer in the program stay at the end.
export function orderedSlots(workout) {
  const order = (data().days[workout.day] || []).map(e => e.id), index = id => { const i = order.indexOf(id); return i < 0 ? order.length : i; };
  return [...workout.slots].sort((a, b) => index(a.id) - index(b.id));
}

// detail: the card on the exercise screen — header is plain text, done sets stay open.
export function slotCard(workout, slot, detail = false) {
  const chosen = selectedVariant(slot), main = mainVariant(slot), status = slotStatus(data(), workout, slot), id = esc(slot.id);
  const state = status === 'done' ? 'done' : status === 'skipped' ? 'skipped' : 'active';
  const ref = { workout: workout.id, slot: slot.id, variant: chosen.id };
  // Sets of the chosen alternative first, then sets already logged under other alternatives.
  const sets = [chosen, ...slot.variants.filter(v => v.id !== chosen.id)].flatMap(v => setsOf(slot, v.id).map(s => ({ s, v })))
    .map(({ s, v }, i) => ({ number: i + 1, text: `${nice(s.weight)} кг × ${s.reps}`, note: v.id === chosen.id ? '' : v.name, attrs: `data-workout="${esc(workout.id)}" data-slot="${id}" data-variant="${esc(v.id)}" data-set="${esc(s.id)}"` }));
  // The input always shows the stored draft, else the values to repeat; the draft is stored on the first keystroke.
  const row = draftRow(data(), workout.id, slot.id, chosen.id) || prefill(data(), workout, slot, chosen.id);
  const planned = chosen.sets ?? main.sets;
  return exerciseCard({
    id: slot.id, state, title: chosen.name, replaced: chosen.id !== main.id ? main.name : '', previous: lastTimeText(chosen.weightId, workout.id),
    lifted: kg(slot.variants.reduce((sum, v) => sum + volumeOf(setsOf(slot, v.id), loadFactor(data(), v.weightId)), 0)), // dumbbells count as a pair
    open: detail ? '' : `data-day="${workout.day}" data-id="${id}"`, menu: `data-action="exerciseMenu" data-day="${workout.day}" data-id="${id}"`,
    expanded: openCards.has(slot.id), flat: detail, sets,
    entry: state === 'active' ? setEntry({ ref, weight: row.weight, reps: row.reps, number: sets.length + 1, hint: dumbbellHint(chosen), completeId: slot.id, completeFirst: sets.length >= planned }) : '',
  });
}
const slotSetsCount = slot => slot.variants.reduce((n, v) => n + setsOf(slot, v.id).length, 0);

export function exerciseMenuHtml() {
  const { day, id } = view.modal, workout = activeWorkoutOf(data(), day), slot = findSlot(workout, id);
  if (!slot) return '';
  const chosen = selectedVariant(slot), status = slotStatus(data(), workout, slot);
  const action = (name, label, cls = '') => `<button class="menu-row ${cls}" data-action="${name}" data-day="${day}" data-id="${esc(id)}">${label}</button>`;
  return `<dialog class="modal action-sheet" aria-labelledby="exerciseMenuTitle"><section class="card"><p class="action-sheet-title" id="exerciseMenuTitle">${esc(chosen.name)}</p><div class="menu-list">
    ${action('openVariants', 'Альтернативы')}
    ${status === 'skipped' ? action('toggleSkip', 'Вернуть упражнение') : ''}
    ${slotSetsCount(slot) ? '' : action('removeExercise', 'Удалить из тренировки', 'destructive')}
  </div><button class="menu-row action-sheet-cancel" data-action="close">Отмена</button></section></dialog>`;
}

function templateCard(day, slot) {
  const alternatives = variantsOf(slot).length - 1, id = esc(slot.id);
  return `<article class="ex wk-card" data-id="${id}" data-day="${day}">
    <div class="wk-head"><button class="exercise-link" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" title="Удерживайте и перетащите, чтобы изменить порядок. С клавиатуры: Alt + стрелка вверх или вниз." data-action="openWorkoutExercise" data-day="${day}" data-id="${id}"><span class="ex-name">${esc(slot.name)}</span><span class="ex-meta">${slot.sets} × ${esc(slot.range)}${alternatives ? ` · ${plural(alternatives, ['альтернатива', 'альтернативы', 'альтернатив'])}` : ''}</span></button>${handle}</div>
    <p class="wk-line"><span class="wk-label">Прошлый раз</span> ${lastTimeText(slot.weightId)}</p>
    <div class="wk-actions"><button class="btn small" data-action="openVariants" data-day="${day}" data-id="${id}">Альтернативы</button></div>
  </article>`;
}

export function workoutPage(day) {
  const workout = activeWorkoutOf(data(), day), template = data().days[day] || [];
  if (workout) {
    const p = workoutProgress(data(), workout), slots = orderedSlots(workout), states = slots.map(slot => slotStatus(data(), workout, slot));
    const index = carouselIndex(workout.id, slots.length, Math.max(0, states.findIndex(s => s !== 'done' && s !== 'skipped')));
    const segments = slots.map((slot, i) => ({ id: slot.id, state: states[i] === 'done' ? 'done' : states[i] === 'skipped' ? 'skipped' : 'pending',
      label: `${i + 1}. ${selectedVariant(slot).name}: ${states[i] === 'done' ? 'завершено' : states[i] === 'skipped' ? 'пропущено' : 'не завершено'}` }));
    return `<h1>${dayTitle(day)}</h1>
      ${slots.length ? segmentProgress({ caption: `${p.done} из ${plural(p.total, EXERCISES)}`, segments, current: index }) + carousel({ slides: slots.map(slot => slotCard(workout, slot)), index, unit: 'Упражнение', listAction: `data-action="openOrder" data-day="${day}"` }) : '<div class="empty">В занятии нет упражнений.</div>'}
      <div class="footer-actions stacked dock"><p class="dock-note">Всего объём с отягощением: ${kg(workoutSummary(data(), workout).volume)}</p><button class="btn primary block" data-action="finishWorkout" data-id="${esc(workout.id)}">Завершить тренировку</button></div>`;
  }
  const other = activeWorkouts(data())[0], last = lastCompleted(data(), day);
  const start = other
    ? `<button class="btn primary block" data-action="openWorkout" data-day="${other.day}">Продолжить тренировку ${dayLetter(other.day)}</button><p class="note">Новую тренировку можно начать после завершения текущей.</p>`
    : `<button class="btn primary block" data-action="startWorkout" data-day="${day}" ${template.length ? '' : 'disabled'}>Начать тренировку</button>`;
  return `<h1>${dayTitle(day)}</h1><p class="lede">${plural(template.length, EXERCISES)} · ${last ? 'последняя ' + esc(shortDate(last.date)) : 'ещё не выполнялась'}</p>
    <div class="workout-start">${start}</div>
    <section class="exercise-list wk-list" aria-label="Упражнения программы">${template.map(slot => templateCard(day, slot)).join('') || '<div class="empty">Пока нет упражнений. Добавьте первое кнопкой «+».</div>'}</section>`;
}

const activeFor = slotId => activeWorkouts(data()).find(w => findSlot(w, slotId));

export const actions = {
  exerciseMenu: ({ day, id }) => { view.modal = { type: 'exercise-menu', day, id }; ctx.render(); },
  openWorkoutExercise: ({ day, id }) => {
    const workout = activeWorkoutOf(data(), day), slot = findSlot(workout, id);
    if (!slot && !slotOf(data(), day, id)) return;
    // Prepare input before navigation so the sliding screen never reflows or opens the keyboard.
    view.exerciseTab = 'sets';
    if (slot) {
      const variantId = selectedVariant(slot).id;
      if (!applied(ctx.uc.openDraft(workout.id, slot.id, variantId))) return;
    }
    go(day, id);
  },
  addDayExercise: ({ day }) => openCatalog(day),
  openVariants: ({ day, id }) => { view.modal = { type: 'variants', day, slotId: id }; ctx.render(); },
  completeSlot: ({ id }) => {
    const workout = activeFor(id);
    if (!workout || !applied(ctx.uc.completeSlot(workout.id, id))) return;
    view.modal = null;
    // Move on to the next unfinished exercise (after this one first, then from the start).
    const fresh = activeFor(id), slots = orderedSlots(fresh), at = slots.findIndex(s => s.id === id);
    const pending = i => !['done', 'skipped'].includes(slotStatus(data(), fresh, slots[i]));
    const next = [...slots.keys()].filter(i => i > at).find(pending) ?? [...slots.keys()].find(pending);
    if (next !== undefined) advanceCarousel(next);
    if (view.exerciseId === id) return go(fresh.day); // finished from the exercise screen: back to the list
    rerender();
  },
  toggleSkip: ({ id }) => { const workout = activeFor(id); if (workout && applied(ctx.uc.toggleSkip(workout.id, id))) { view.modal = null; rerender(); } },
  removeExercise: async ({ day, id }) => {
    const slot = findSlot(activeWorkoutOf(data(), day), id);
    if (!slot || !await ds.confirm('Удалить упражнение?', 'Оно пропадёт из этой тренировки и из программы. В базе упражнение и его история останутся.', { ok: 'Удалить', destructive: true })) return;
    if (applied(ctx.uc.removeFromProgram(day, id))) { view.modal = null; if (view.exerciseId === id) go(day); else rerender(); }
  },
  workoutMenu: async ({ id }) => {
    const choice = await ds.alert({ title: 'Занятие', actions: [{ label: 'Удалить занятие', value: 'delete', style: 'destructive' }, { label: 'Отмена', value: null, cancel: true }] });
    if (choice === 'delete') deleteWorkout(id);
  },
};
