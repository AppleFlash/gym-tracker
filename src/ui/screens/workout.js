// Workout screen. Without an active workout: the template (slots, alternatives, plan) and "Start".
// During a workout: one card per slot with last time, today's sets, quick set entry, replace, finish/skip.
import { findItem } from '../../domain/catalog.js';
import { variantsOf, slotOf } from '../../domain/program.js';
import { activeWorkouts, activeWorkoutOf, findSlot, selectedVariant, mainVariant, setsOf, slotStatus, workoutProgress, lastPerformance, lastCompleted } from '../../domain/workout.js';
import { ctx, view, data, applied, rerender } from '../context.js';
import { esc, dayTitle, dayLetter, shortDate, setsText, plural, EXERCISES, SETS, STATUS_TEXT, moreIcon } from '../format.js';
import { go } from '../router.js';
import { setChips, quickRow, draftHint, isOpen } from '../sets.js';
import { openCatalog } from '../sheets/catalog.js';
import { deleteWorkout } from './home.js';

const lastTimeText = (weightId, exceptId) => {
  const last = lastPerformance(data(), weightId, exceptId);
  return last ? `${esc(shortDate(last.workout.date))}: ${setsText(last.sets)}` : 'нет данных';
};
const handle = '<span class="drag-handle" title="Перетащить" aria-hidden="true">⠿</span>';

// Workout slots follow the current program order; slots no longer in the program stay at the end.
function orderedSlots(workout) {
  const order = (data().days[workout.day] || []).map(e => e.id), index = id => { const i = order.indexOf(id); return i < 0 ? order.length : i; };
  return [...workout.slots].sort((a, b) => index(a.id) - index(b.id));
}

function activeCard(workout, slot) {
  const chosen = selectedVariant(slot), main = mainVariant(slot), status = slotStatus(data(), workout, slot), id = esc(slot.id);
  const count = slotSetsCount(slot), canComplete = count > 0 && status !== 'done' && status !== 'skipped';
  const done = status === 'done', ready = canComplete && count >= (chosen.sets ?? main.sets);
  const open = isOpen(workout, slot, chosen.id);
  const others = slot.variants.filter(v => v.id !== chosen.id && setsOf(slot, v.id).length)
    .map(v => `${esc(v.name)} — ${plural(setsOf(slot, v.id).length, SETS)}`);
  return `<article class="ex wk-card is-${status}" data-id="${id}" data-day="${workout.day}">
    <div class="wk-head"><button class="exercise-link" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" title="Удерживайте и перетащите, чтобы изменить порядок. С клавиатуры: Alt + стрелка вверх или вниз." data-action="openWorkoutExercise" data-day="${workout.day}" data-id="${id}"><span class="ex-name">${esc(chosen.name)}</span>${chosen.id !== main.id ? `<span class="ex-meta">Вместо: ${esc(main.name)}</span>` : ''}</button><button class="icon-btn wk-more" data-action="exerciseMenu" data-day="${workout.day}" data-id="${id}" aria-label="Действия с упражнением: ${esc(chosen.name)}" aria-haspopup="dialog">${moreIcon}</button></div>
    <p class="wk-plan">${chosen.sets ?? main.sets} × ${esc(chosen.range ?? main.range)}<span aria-hidden="true"> · </span><span class="wk-status s-${status}">${STATUS_TEXT[status]}</span></p>
    <p class="wk-line wk-previous"><span>Прошлый раз ·</span> ${lastTimeText(chosen.weightId, workout.id)}</p>
    ${setsOf(slot, chosen.id).length ? `<div class="wk-line wk-today"><span class="wk-label">Сегодня</span>${setChips(workout, slot, chosen.id)}</div>` : ''}
    ${others.length ? `<p class="wk-line"><span class="wk-label">Также</span> ${others.join(', ')}</p>` : ''}
    ${slot.legacyDone ? '<p class="wk-line note">Отмечено выполненным в прошлой версии, подходы не записаны.</p>' : ''}
    ${findItem(data(), chosen.weightId)?.note ? `<p class="personal-note">${esc(findItem(data(), chosen.weightId).note)}</p>` : ''}
    ${open ? quickRow(workout, slot, chosen.id, 'completeSlot') : draftHint(workout, slot, chosen.id)}
    ${open ? '' : `<div class="wk-actions"><button class="btn ${ready || done ? '' : 'primary'} add-set-action" data-action="addSet" data-workout="${esc(workout.id)}" data-slot="${id}" data-variant="${esc(chosen.id)}">+ Подход</button>${canComplete ? `<button class="btn ${ready ? 'primary' : ''}" data-action="completeSlot" data-id="${id}" aria-label="Завершить упражнение: ${esc(chosen.name)}">Завершить</button>` : done ? '<button class="btn complete-state" disabled>Завершено</button>' : `<button class="btn" data-action="openVariants" data-day="${workout.day}" data-id="${id}">Альтернативы</button>`}</div>`}
  </article>`;
}
const slotSetsCount = slot => slot.variants.reduce((n, v) => n + setsOf(slot, v.id).length, 0);

export function exerciseMenuHtml() {
  const { day, id } = view.modal, workout = activeWorkoutOf(data(), day), slot = findSlot(workout, id);
  const template = slotOf(data(), day, id);
  if (!slot && !template) return '';
  const chosen = slot ? selectedVariant(slot) : template, status = slot ? slotStatus(data(), workout, slot) : null;
  const count = slot ? slotSetsCount(slot) : 0;
  const action = (name, label) => `<button class="menu-row" data-action="${name}" data-day="${day}" data-id="${esc(id)}">${label}</button>`;
  return `<dialog class="modal action-sheet exercise-menu-sheet" aria-labelledby="exerciseMenuTitle"><section class="card"><div class="exercise-menu-content"><p class="action-sheet-title" id="exerciseMenuTitle">${esc(chosen.name)}</p><div class="menu-list">
    ${chosen.weightId ? `<button class="menu-row" data-action="openTechnique" data-id="${esc(chosen.weightId)}">Техника</button>` : ''}
    ${slot && (count || status === 'done' || isOpen(workout, slot, chosen.id)) ? action('openVariants', 'Альтернативы') : ''}
    ${slot ? status === 'skipped' ? action('toggleSkip', 'Вернуть упражнение') : status !== 'done' && !count ? action('toggleSkip', 'Пропустить') : '' : ''}
    ${count ? '' : action('removeExercise', 'Удалить из тренировки').replace('class="menu-row"', 'class="menu-row destructive"')}
  </div></div><footer class="sheet-footer"><button class="btn" data-action="close">Закрыть</button></footer></section></dialog>`;
}

function templateCard(day, slot) {
  const alternatives = variantsOf(slot).length - 1, id = esc(slot.id);
  return `<article class="ex wk-card" data-id="${id}" data-day="${day}">
    <div class="wk-head"><button class="exercise-link" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" title="Удерживайте и перетащите, чтобы изменить порядок. С клавиатуры: Alt + стрелка вверх или вниз." data-action="openWorkoutExercise" data-day="${day}" data-id="${id}"><span class="ex-name">${esc(slot.name)}</span><span class="ex-meta">${slot.sets} × ${esc(slot.range)}${alternatives ? ` · ${plural(alternatives, ['альтернатива', 'альтернативы', 'альтернатив'])}` : ''}</span></button>${handle}<button class="icon-btn wk-more" data-action="exerciseMenu" data-day="${day}" data-id="${id}" aria-label="Действия с упражнением: ${esc(slot.name)}" aria-haspopup="dialog">${moreIcon}</button></div>
    <p class="wk-line"><span class="wk-label">Прошлый раз</span> ${lastTimeText(slot.weightId)}</p>
    <div class="wk-actions"><button class="btn small" data-action="openVariants" data-day="${day}" data-id="${id}">Альтернативы</button></div>
  </article>`;
}

function weightNotice() {
  if (data().profile.weightNoticeSeen) return '';
  return `<section class="card notice"><p>Для упражнений с оборудованием «Гантели» вводите вес одной гантели — объём считается на пару. Укажите оборудование в карточке упражнения.</p><button class="btn small" data-action="dismissWeightNotice">Понятно</button></section>`;
}

export function workoutPage(day) {
  const workout = activeWorkoutOf(data(), day), template = data().days[day] || [];
  if (workout) {
    const p = workoutProgress(data(), workout);
    return `<h1>${dayTitle(day)}</h1><p class="lede">${p.done} из ${plural(p.total, EXERCISES)} завершено</p>
      ${weightNotice()}
      <section class="exercise-list wk-list" aria-label="Упражнения тренировки">${orderedSlots(workout).map(slot => activeCard(workout, slot)).join('') || '<div class="empty">В занятии нет упражнений.</div>'}</section>
      <div class="footer-actions stacked"><button class="btn primary block" data-action="finishWorkout" data-id="${esc(workout.id)}">Завершить тренировку</button></div>`;
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
    if (slot) {
      const variantId = selectedVariant(slot).id;
      if (!applied(ctx.uc.openDraft(workout.id, slot.id, variantId))) return;
      view.draft = { workoutId: workout.id, slotId: slot.id, variantId };
    }
    go(day, id);
  },
  addDayExercise: ({ day }) => openCatalog(day),
  openVariants: ({ day, id }) => { view.modal = { type: 'variants', day, slotId: id }; ctx.render(); },
  completeSlot: ({ id }) => {
    const workout = activeFor(id);
    if (workout && applied(ctx.uc.completeSlot(workout.id, id))) { view.modal = null; if (view.draft?.slotId === id) view.draft = null; rerender(); }
  },
  toggleSkip: ({ id }) => { const workout = activeFor(id); if (workout && applied(ctx.uc.toggleSkip(workout.id, id))) { view.modal = null; rerender(); } },
  removeExercise: async ({ day, id }) => {
    const slot = findSlot(activeWorkoutOf(data(), day), id) || slotOf(data(), day, id);
    if (!slot || !await ds.confirm('Удалить упражнение?', 'Оно пропадёт из этой тренировки и из программы. В базе упражнение и его история останутся.', { ok: 'Удалить', destructive: true })) return;
    if (applied(ctx.uc.removeFromProgram(day, id))) { view.modal = null; if (view.draft?.slotId === id) view.draft = null; rerender(); }
  },
  dismissWeightNotice: () => { if (applied(ctx.uc.dismissWeightNotice())) rerender(); },
  workoutMenu: async ({ id }) => {
    const choice = await ds.alert({ title: 'Занятие', actions: [{ label: 'Удалить занятие', value: 'delete', style: 'destructive' }, { label: 'Отмена', value: null, cancel: true }] });
    if (choice === 'delete') deleteWorkout(id);
  },
};

