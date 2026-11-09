// Workouts list and a day's program: completion marks, alternatives, finish/reset.
import { variantsOf, activeVariant, slotOf, isDone, dayProgress } from '../../domain/program.js';
import { findItem, lastRecord } from '../../domain/catalog.js';
import { sessionFor } from '../../domain/session.js';
import { ctx, view, data, applied } from '../context.js';
import { esc, dayTitle, displayRecord, timeLabel, ring } from '../format.js';
import { go } from '../router.js';
import { openCatalog } from '../sheets/catalog.js';

export function exerciseStatus(day, exercise) {
  const session = sessionFor(data(), day, exercise.id);
  if (session?.completedAt) return `Сохранено в ${timeLabel(session.completedAt)} · ${session.sets.length} подх.`;
  if (session) return 'В процессе';
  return isDone(data(), day, exercise.id) ? 'Выполнено' : '';
}

function exerciseRow(day, exercise) {
  const chosen = activeVariant(exercise), record = lastRecord(findItem(data(), chosen.weightId)), done = isDone(data(), day, exercise.id);
  const expanded = view.expanded.has(day + ':' + exercise.id), status = exerciseStatus(day, chosen), id = esc(exercise.id), name = esc(exercise.name);
  return `<div class="ex ${done ? 'completed' : ''}" data-id="${id}" data-day="${day}">
    <div class="ex-main"><button class="check ${done ? 'checked' : ''}" aria-label="${done ? 'Снять отметку' : 'Отметить выполнение'}: ${name}" aria-pressed="${done}" data-action="done" data-id="${id}" data-day="${day}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11.5l4 4 8-8"/></svg></button>
    <button class="exercise-link" data-action="openWorkoutExercise" data-day="${day}" data-id="${id}"><span class="ex-name">${name}</span><span class="ex-meta">${chosen.id !== exercise.id ? 'Выбрано: ' + esc(chosen.name) + '<br>' : ''}${chosen.sets} × ${esc(chosen.range)} ${record ? '· ' + displayRecord(record) : ''}${status ? '<br>' + status : ''}</span></button>
    <button class="alternative-toggle" data-action="toggleAlternatives" data-day="${day}" data-id="${id}" aria-label="Аналогичные упражнения: ${name}" aria-expanded="${expanded}" aria-controls="alternatives-${id}"><span aria-hidden="true">›</span></button>
    <span class="drag-handle" title="Перетащить" aria-hidden="true">⠿</span></div>
    <div class="alternatives-panel" id="alternatives-${id}" ${expanded ? '' : 'hidden'}>
      <div role="radiogroup" aria-label="Выбор упражнения вместо ${name}">${variantsOf(exercise).map(variant => {
        const variantStatus = exerciseStatus(day, variant);
        return `<button class="alternative-option" role="radio" aria-checked="${variant.id === chosen.id}" data-action="selectWorkoutVariant" data-day="${day}" data-id="${id}" data-variant="${esc(variant.id)}"><span class="variant-radio" aria-hidden="true"></span><span class="variant-description"><strong>${esc(variant.name)}</strong><span class="ex-meta">${variant.id === exercise.id ? 'Исходное упражнение' : 'Аналогичное упражнение'}${variantStatus ? ' · ' + variantStatus : ''}</span></span></button>`;
      }).join('')}</div>
      <button class="btn small" data-action="addAlternative" data-day="${day}" data-id="${id}">+ Аналогичное упражнение</button>
    </div></div>`;
}

export function workoutsPage() {
  const row = day => {
    const p = dayProgress(data(), day);
    return `<button class="workout-row" data-action="openWorkout" data-day="${day}">${ring(p.pct, day === 'star' ? '★' : day)}<span class="workout-row-body"><strong>${dayTitle(day)}</strong><span class="muted">${p.done} из ${p.total} упражнений${data().today === day ? '<span class="today-tag">Сегодня</span>' : ''}</span></span><span class="row-chevron" aria-hidden="true">›</span></button>`;
  };
  const fresh = ds.fresh ? 'fresh' : '';
  return `<h1>Тренировки</h1><section class="card workout-list ${fresh}" aria-label="Программа тренировок">${['A', 'B', 'C'].map(row).join('')}</section><h2 class="group-title">Дополнительно</h2><section class="card workout-list ${fresh}" aria-label="Дополнительные тренировки">${row('star')}</section>`;
}

export function dayPage(day) {
  const exercises = data().days[day] || [], p = dayProgress(data(), day), on = data().today === day;
  return `<h1>${dayTitle(day)}</h1>
  <section class="card list"><button type="button" class="list-row row-switch" data-action="today" data-id="${day}" role="switch" aria-checked="${on}"><span>Сегодняшняя тренировка</span><span class="switch" aria-hidden="true"></span></button></section>
  <section class="card"><div class="row"><div><div class="muted">Прогресс тренировки</div><strong>${p.done} из ${p.total} упражнений</strong></div><div class="percent">${p.pct}%</div></div><div class="progress" role="progressbar" aria-valuenow="${p.pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${p.pct}%"></div></div></section>
  <section class="card exercise-list" aria-label="Упражнения">${exercises.length ? exercises.map(e => exerciseRow(day, e)).join('') : '<div class="empty">Пока нет упражнений. Добавьте первое.</div>'}</section>
  <div class="footer-actions stacked"><button class="btn primary block" data-action="finish" data-day="${day}" ${exercises.length ? '' : 'disabled'}>Завершить тренировку</button><button class="btn danger block" data-action="reset" data-day="${day}">Сбросить прогресс</button></div>
  <p class="note">«Завершить тренировку» сохраняет результат в историю и очищает отметки. «Сбросить прогресс» очищает отметки без записи в историю.</p>`;
}

// Animates the progress bar from the previously drawn value after a re-render.
export function animateDayProgress(day) {
  const bar = document.querySelector('.progress-fill'), target = dayProgress(data(), day).pct;
  if (bar) { bar.style.width = view.progress[day] + '%'; requestAnimationFrame(() => { bar.style.width = target + '%'; }); }
  view.progress[day] = target;
}

function toggleAlternatives(day, id) {
  const key = day + ':' + id, app = document.getElementById('app'), top = app.scrollTop;
  view.expanded.has(key) ? view.expanded.delete(key) : view.expanded.add(key);
  ctx.render();
  app.scrollTop = top;
}

const selectVariant = (day, id, variantId) => { if (applied(ctx.uc.selectVariant(day, id, variantId))) ctx.render(); };

async function finish(day) {
  const p = dayProgress(data(), day);
  if (!p.total) return;
  if (!await ds.confirm('Завершить тренировку?', `«${dayTitle(day)}»: выполнено ${p.done} из ${p.total} (${p.pct}%). Результат сохранится в истории, отметки очистятся.`, { ok: 'Завершить' })) return;
  const result = ctx.uc.finishWorkout(day);
  if (result?.storage) return alert('Не удалось сохранить тренировку. Отметки сохранены на экране — попробуйте ещё раз или экспортируйте данные.');
  if (!applied(result)) return;
  data().tab = 'history';
  ctx.store.persist();
  view.exerciseId = null;
  view.progress[day] = 0;
  ctx.render();
  document.getElementById('app').scrollTop = 0;
}

async function reset(day) {
  if (!await ds.confirm('Сбросить прогресс?', 'Отметки выполнения дня «' + dayTitle(day) + '» будут очищены. История тренировок не изменится.', { ok: 'Сбросить', destructive: true })) return;
  applied(ctx.uc.resetDay(day));
  ctx.render();
}

export const actions = {
  openWorkout: ({ day }) => go(day),
  openWorkoutExercise: ({ day, id }) => { const slot = slotOf(data(), day, id); if (slot) go(day, activeVariant(slot).id); },
  toggleAlternatives: ({ day, id }) => toggleAlternatives(day, id),
  selectWorkoutVariant: ({ day, id, variant }) => selectVariant(day, id, variant),
  addAlternative: ({ day, id }) => openCatalog(day, id),
  addDayExercise: ({ day }) => openCatalog(day),
  editDayExercise: ({ day, id }) => { view.modal = { type: 'day', day, id }; ctx.render(); },
  done: ({ day, id }) => { if (applied(ctx.uc.toggleDone(day, id))) ctx.render(); },
  today: ({ id }) => { applied(ctx.uc.toggleToday(id)); ctx.render(); },
  finish: ({ day }) => finish(day),
  reset: ({ day }) => reset(day),
};

const ARROWS = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
export const listeners = [
  // Arrow keys move the choice inside an alternatives radio group.
  ['keydown', ev => {
    if (!ev.target.matches('.alternative-option') || !ARROWS.includes(ev.key)) return;
    ev.preventDefault();
    const options = [...ev.target.parentNode.querySelectorAll('.alternative-option')], index = options.indexOf(ev.target);
    const forward = ['ArrowDown', 'ArrowRight'].includes(ev.key);
    const target = options[ev.key === 'Home' ? 0 : ev.key === 'End' ? options.length - 1 : (index + (forward ? 1 : options.length - 1)) % options.length];
    const { day, id, variant } = target.dataset;
    selectVariant(day, id, variant);
    document.querySelector(`.alternative-option[data-variant="${CSS.escape(variant)}"]`)?.focus();
  }],
];
