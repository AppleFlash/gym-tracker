// Home: which workout is next (or running now) and the program list. Opening a template never starts anything.
import { ROTATION, nextDay, dayAfter, activeWorkouts, activeWorkoutOf, lastCompleted, workoutProgress, findWorkout, firstDraft, workoutSummary } from '../../domain/workout.js';
import { ctx, view, data, applied } from '../context.js';
import { esc, dayTitle, dayLetter, shortDate, longDate, ring, plural, EXERCISES } from '../format.js';
import { go } from '../router.js';

function heroHtml() {
  const actives = activeWorkouts(data());
  if (actives.length > 1) {
    // Version 1 allowed several days in progress at once: each must be resolved before a new workout starts.
    return `<section class="card hero"><div class="hero-body"><h2>Незавершённые из предыдущей версии</h2><p class="note">Продолжите, завершите или удалите каждую. Новую тренировку можно начать после этого.</p></div>${actives.map(w => {
      const p = workoutProgress(data(), w);
      return `<div class="legacy-row"><div class="legacy-title"><strong>${dayTitle(w.day)}</strong><span class="muted">начата ${esc(shortDate(w.date))} · ${p.done} из ${p.total}</span></div><div class="legacy-actions"><button class="btn small" data-action="openWorkout" data-day="${w.day}">Продолжить</button><button class="btn small" data-action="finishWorkout" data-id="${esc(w.id)}">Завершить</button><button class="btn small danger" data-action="deleteWorkout" data-id="${esc(w.id)}">Удалить</button></div></div>`;
    }).join('')}</section>`;
  }
  const active = actives[0];
  if (active) {
    const p = workoutProgress(data(), active);
    return `<section class="card hero"><div class="hero-row">${ring(p.pct, dayLetter(active.day), 'md')}<div class="hero-body"><span class="hero-label">Сейчас</span><h2>${dayTitle(active.day)}</h2><p class="muted">${p.done} из ${plural(p.total, EXERCISES)} завершено</p></div></div><button class="btn primary block" data-action="openWorkout" data-day="${active.day}">Продолжить ${dayLetter(active.day)}</button></section>`;
  }
  const next = nextDay(data()), last = ROTATION.map(d => lastCompleted(data(), d)).filter(Boolean).sort((a, b) => a.completedAt.localeCompare(b.completedAt)).at(-1);
  return `<section class="card hero"><div class="hero-body"><span class="hero-label">Следующая тренировка</span><h2>${dayTitle(next)}</h2><p class="muted">${last ? `Последняя завершённая: ${last.day} · ${esc(longDate(last.date).replace(/ \d{4} г\.$/, ''))}` : `Начните с тренировки ${next}`}</p></div><button class="btn primary block" data-action="startWorkout" data-day="${next}">Начать ${next}</button></section>`;
}

function dayRow(day) {
  const active = activeWorkoutOf(data(), day), last = lastCompleted(data(), day), count = (data().days[day] || []).length;
  const next = !activeWorkouts(data()).length && day === nextDay(data()) || activeWorkouts(data()).length === 1 && day === dayAfter(activeWorkouts(data())[0].day);
  const tag = active ? '<span class="tag">В процессе</span>' : next && day !== 'star' ? '<span class="tag quiet">Следующая</span>' : '';
  const badge = `<span class="day-badge" aria-hidden="true">${dayLetter(day)}</span>`;
  const start = !activeWorkouts(data()).length && count ? `<button class="btn small" data-action="startWorkout" data-day="${day}" aria-label="Начать тренировку ${dayLetter(day)}">Начать</button>` : '';
  return `<div class="workout-start-row"><button class="workout-row" data-action="openWorkout" data-day="${day}">${badge}<span class="workout-row-body"><strong>${dayTitle(day)}${tag}</strong><span class="muted">${plural(count, EXERCISES)} · ${last ? 'последняя ' + esc(shortDate(last.date)) : 'ещё не выполнялась'}</span></span><span class="row-chevron" aria-hidden="true">›</span></button>${start}</div>`;
}

export const homePage = () => `<h1>Тренировки</h1>${heroHtml()}<h2 class="group-title">Программа</h2><section class="card workout-list" aria-label="Программа тренировок">${ROTATION.map(dayRow).join('')}</section><h2 class="group-title">Дополнительно</h2><section class="card workout-list" aria-label="Дополнительная тренировка">${dayRow('star')}</section>`;

// Starts a workout and opens it. Shared by the home card and the workout screen.
export function startWorkout(day) {
  if (applied(ctx.uc.startWorkout(day))) go(day);
}

// Finishing: drafts block it and lead to the first one; a partial workout may finish, then its result opens.
export async function finishWorkout(workoutId) {
  const workout = findWorkout(data(), workoutId);
  if (!workout) return;
  const draft = firstDraft(data(), workout);
  if (draft) {
    const slot = workout.slots.find(s => s.id === draft.slotId);
    if (slot.selectedId !== draft.variantId && !applied(ctx.uc.selectVariant(workoutId, draft.slotId, draft.variantId))) return;
    if (data().tab !== workout.day || view.exerciseId) go(workout.day, null, false);
    ctx.render();
    const input = document.querySelector(`.set-entry[data-slot="${draft.slotId}"] [data-draft-field="weight"]`);
    input?.scrollIntoView({ block: 'center' });
    input?.focus({ preventScroll: true });
    return alert('Сохраните подход или очистите поля ввода.');
  }
  const s = workoutSummary(data(), workout);
  if (!await ds.confirm('Завершить тренировку?', `Завершено ${s.done} из ${s.total}, подходов: ${s.setCount}. Упражнения без подходов будут отмечены как пропущенные.`, { ok: 'Завершить' })) return;
  if (!applied(ctx.uc.finishWorkout(workoutId))) return;
  view.resultFrom = 'workouts';
  go('result', workoutId);
}

export async function deleteWorkout(workoutId) {
  if (!await ds.confirm('Удалить занятие?', 'Будут удалены подходы этого занятия. Программа и прошлая история сохранятся.', { ok: 'Удалить', destructive: true })) return;
  if (!applied(ctx.uc.deleteWorkout(workoutId))) return;
  go('workouts');
}

export const actions = {
  openWorkout: ({ day }) => go(day),
  startWorkout: ({ day }) => startWorkout(day),
  finishWorkout: ({ id }) => finishWorkout(id),
  deleteWorkout: ({ id }) => deleteWorkout(id),
};
