// Result of one finished workout: done/total, sets, volume with load, the exercises actually performed.
// Sets can be corrected here; every view recomputes from the same saved sets.
import { findWorkout, workoutSummary } from '../../domain/workout.js';
import { ctx, view, data } from '../context.js';
import { esc, dayTitle, longDate, shortDate, kg, ring, dayLetter, helpButton, plural, EXERCISES } from '../format.js';
import { go } from '../router.js';
import { setChips } from '../sets.js';
import { discuss } from './chat.js';

export function resultPage(workoutId) {
  const workout = findWorkout(data(), workoutId);
  if (!workout || workout.status !== 'completed') return '<div class="empty">Тренировка не найдена.</div>';
  const s = workoutSummary(workout), pct = s.total ? Math.round(s.done / s.total * 100) : 0;
  const skipped = workout.slots.filter(slot => slot.status === 'skipped').map(slot => esc(slot.name));
  const legacyMarks = workout.slots.filter(slot => slot.legacyDone).map(slot => esc(slot.name));
  return `<h1>${dayTitle(workout.day)}</h1><p class="lede">${esc(longDate(workout.date))}</p>
    <section class="card result-head ${view.resultFrom === 'workouts' ? 'fresh' : ''}">${ring(pct, dayLetter(workout.day), 'md')}<dl class="stats">
      <div><dt>Упражнения</dt><dd class="num">${s.done} из ${s.total}</dd></div>
      <div><dt>Подходы</dt><dd class="num">${s.setCount}</dd></div>
      <div><dt>Объём с отягощением ${helpButton('volumeHelp', 'Как считается объём')}</dt><dd class="num">${kg(s.volume)}</dd></div>
    </dl></section>
    ${s.exercises.length ? `<h2 class="group-title">Выполнено</h2><section class="card list">${s.exercises.map(e => `<div class="result-row"><strong>${esc(e.variant.name)}</strong>${e.instead ? `<span class="ex-meta">Вместо: ${esc(e.instead)}</span>` : ''}${setChips(workout, e.slot, e.variant.id)}</div>`).join('')}</section><p class="note">Нажмите на подход, чтобы исправить или удалить его.</p>` : '<section class="card"><p class="note">Подходы не записаны.</p></section>'}
    ${legacyMarks.length ? `<p class="note">Отмечены выполненными без подходов: ${legacyMarks.join(', ')}.</p>` : ''}
    ${skipped.length ? `<p class="note">Пропущено: ${skipped.join(', ')}.</p>` : ''}
    <div class="footer-actions stacked"><button class="btn block" data-action="discussWorkout" data-id="${esc(workout.id)}">Разобрать с ИИ</button><button class="btn primary block" data-action="toWorkouts">К тренировкам</button></div>`;
}

export const actions = {
  volumeHelp: () => ds.alert({ title: 'Объём с отягощением', message: 'Сумма «вес × повторения» по всем сохранённым подходам. Вес — суммарный внешний: две гантели по 20 кг — это 40 кг. Подходы с весом 0 в объём не входят.', actions: [{ label: 'Понятно', value: true, style: 'default', cancel: true }] }),
  toWorkouts: () => go('workouts'),
  discussWorkout: ({ id }) => {
    const workout = findWorkout(data(), id);
    if (workout) discuss({ kind: 'workout', id, label: `${dayTitle(workout.day)}, ${shortDate(workout.date)}` }, 'Разбери эту тренировку: что получилось и на что обратить внимание в следующий раз?');
  },
};

export const historyRow = w => {
  const s = workoutSummary(w);
  return `<button class="menu-row history-row" data-action="openResult" data-id="${esc(w.id)}"><span><strong>${dayTitle(w.day)}</strong><small>${esc(longDate(w.date))} · ${s.done} из ${plural(s.total, EXERCISES)}${s.setCount ? '' : ' · подходы не записаны'}</small></span><span aria-hidden="true">›</span></button>`;
};
actions.openResult = ({ id }) => { view.resultFrom = 'profile'; go('result', id); };
