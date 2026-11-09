// Exercise screen: weight chart and history of the catalog item, recording sets of the current workout.
import { findItem } from '../../domain/catalog.js';
import { sessionFor } from '../../domain/session.js';
import { ctx, view, data, route, applied } from '../context.js';
import { esc, nice, hasReps, dayTitle, timeLabel, shortDate, longDate } from '../format.js';
import { go } from '../router.js';

const savedSets = sets => `<ol class="saved-sets">${sets.map(set => `<li>${nice(set.weight)} кг × ${esc(set.reps)}</li>`).join('')}</ol>`;

function setsForm(session) {
  const rows = session.sets.map((set, i) => {
    const id = esc(set.id), n = i + 1;
    return `<div class="set-row" data-set="${id}"><span>${n}</span><label class="sr" for="set-weight-${id}">Вес подхода ${n}, кг</label><input id="set-weight-${id}" data-set-field="weight" inputmode="decimal" value="${esc(set.weight)}" placeholder="0" required><label class="sr" for="set-reps-${id}">Повторения подхода ${n}</label><input id="set-reps-${id}" data-set-field="reps" inputmode="numeric" value="${esc(set.reps)}" placeholder="8" required><button type="button" class="btn small" data-action="removeSet" data-id="${id}" aria-label="Удалить подход ${n}" ${session.sets.length === 1 ? 'disabled' : ''}>×</button></div>`;
  }).join('');
  return `<form id="workoutSetsForm"><div class="set-labels" aria-hidden="true"><span>№</span><span>Вес, кг</span><span>Повторы</span><span></span></div><div class="sets-list">${rows}</div><div class="footer-actions"><button type="button" class="btn" data-action="addSet">+ Подход</button><button type="submit" class="btn primary">Сохранить</button></div><p class="note">Укажите 0 кг для упражнений без отягощения. Сохранение отметит упражнение выполненным.</p></form>`;
}

export function exercisePage(day, exercise) {
  const session = sessionFor(data(), day, exercise.id), records = findItem(data(), exercise.weightId)?.records || [];
  const points = records.map((r, i) => ({ v: Number(r.weight) || 0, t: r.date ? Date.parse(r.date + 'T12:00:00') || null : null, label: shortDate(r.date, i), sub: shortDate(r.date, i) + (hasReps(r) ? ' · ' + r.reps + ' повт.' : '') }));
  const chart = records.length
    ? ds.chartCard('weight-' + exercise.weightId, { pts: points, unit: 'кг', label: 'История рабочего веса: ' + exercise.name })
    : '<section class="card"><h2>История веса</h2><p class="note">Записей пока нет. Сохраните подходы, чтобы начать историю веса.</p></section>';
  const started = session ? `<p class="note">Начато в ${timeLabel(session.startedAt)}${session.completedAt ? ' · Сохранено в ' + timeLabel(session.completedAt) : ' · В процессе'}</p>` : '';
  const body = session && !session.completedAt ? setsForm(session)
    : `${session?.completedAt ? savedSets(session.sets) : '<p class="note">Начните упражнение, чтобы записать вес и повторения каждого подхода.</p>'}<div class="footer-actions"><button class="btn primary" data-action="startWorkoutExercise">${session?.completedAt ? 'Изменить подходы' : 'Начать упражнение'}</button></div>`;
  const history = records.length ? `<h2 class="group-title">История</h2><section class="card list" aria-label="История рабочего веса">${[...records].reverse().map(r => `<div class="list-row"><span>${r.date ? esc(longDate(r.date)) : 'Без даты'}</span><span class="num">${nice(r.weight)} кг${hasReps(r) ? ' × ' + esc(r.reps) : ''}</span></div>`).join('')}</section>` : '';
  return `<h1>${esc(exercise.name)}</h1><p class="lede">${dayTitle(day)} · ${exercise.sets} × ${esc(exercise.range)}</p>
    ${chart}
    <section class="card"><h2>Текущая тренировка</h2>${started}
    ${body}</section>
    ${history}`;
}

const rerenderIf = result => { if (applied(result)) ctx.render(); };

export const actions = {
  startWorkoutExercise: () => { const r = route(); rerenderIf(ctx.uc.startExercise(r.tab, r.id)); },
  addSet: () => { const r = route(); rerenderIf(ctx.uc.addSet(r.tab, r.id)); },
  removeSet: ({ id }) => { const r = route(); rerenderIf(ctx.uc.removeSet(r.tab, r.id, id)); },
};

export const listeners = [
  ['input', ev => {
    const field = ev.target.dataset.setField, setId = ev.target.closest('[data-set]')?.dataset.set;
    if (field && setId) ctx.uc.editSet(data().tab, view.exerciseId, setId, field, ev.target.value);
  }],
  ['submit', ev => {
    if (ev.target.id !== 'workoutSetsForm') return;
    ev.preventDefault();
    const r = route();
    if (applied(ctx.uc.saveExercise(r.tab, r.id))) go(r.tab);
  }],
];
