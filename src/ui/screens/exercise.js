// Exercise screen. In a workout: last time, today's sets with entry, finish; then chart and history.
// From the profile ('item' route): the same history of a catalog exercise without the workout part.
import { slotOf } from '../../domain/program.js';
import { findItem, itemGroup, itemUsage, EQUIPMENT } from '../../domain/catalog.js';
import { activeWorkoutOf, findSlot, selectedVariant, mainVariant, setsOf, slotStatus, performancesOf, lastPerformance, representativeSet } from '../../domain/workout.js';
import { ctx, view, data, applied } from '../context.js';
import { esc, nice, hasReps, dayTitle, shortDate, longDate, setsText, plural, SETS, STATUS_TEXT } from '../format.js';
import { go } from '../router.js';
import { setChips, quickRow, isOpen } from '../sets.js';
import { discuss } from './chat.js';

function lastTimeCard(weightId, exceptId) {
  const last = lastPerformance(data(), weightId, exceptId);
  return `<section class="card"><h2>Прошлый раз</h2>${last ? `<p class="muted">${esc(longDate(last.workout.date))} · ${dayTitle(last.workout.day)}</p><p class="big-sets">${setsText(last.sets)}</p>` : '<p class="note">Завершённых выполнений пока нет.</p>'}</section>`;
}

// Weight and reps of one representative set per completed workout, last 6, labels always visible.
function chartCard(weightId) {
  const runs = performancesOf(data(), weightId).slice(-6);
  if (!runs.length) return '<section class="card"><h2>Прогресс</h2><p class="note">График появится после первой завершённой тренировки с этим упражнением.</p></section>';
  const points = runs.map(r => { const s = representativeSet(r.sets); return { label: shortDate(r.workout.date), weight: s.weight, reps: s.reps }; });
  return `<section class="card chart-card"><h2>Прогресс</h2><p class="note">Основной подход каждого занятия: самый тяжёлый, при равном весе — с большим числом повторений.</p>${ds.trendChart(points, 'Вес и повторения по последним занятиям')}</section>`;
}

function historyBlock(weightId) {
  const runs = performancesOf(data(), weightId).reverse();
  return runs.length ? `<h2 class="group-title">История</h2><section class="card list" aria-label="История по занятиям">${runs.map(r => `<details class="history-run"><summary><span>${esc(longDate(r.workout.date))}<small>${dayTitle(r.workout.day)} · ${plural(r.sets.length, SETS)}</small></span><span class="num">${setsText([representativeSet(r.sets)])}</span></summary><p class="big-sets">${setsText(r.sets)}</p></details>`).join('')}</section>` : '';
}

// Weight journal from before workouts existed: kept apart, never mixed into the chart.
function legacyRecords(weightId) {
  const item = findItem(data(), weightId), group = data().groups.find(g => g.items.includes(item));
  if (!item?.records.length) return '';
  return `<h2 class="group-title">Ранее сохранённые записи</h2><section class="card list" aria-label="Ранее сохранённые записи">${[...item.records].reverse().map(r => `<button class="list-row rec-row" data-action="editRecord" data-group="${esc(group.id)}" data-id="${esc(item.id)}" data-record="${esc(r.id)}"><span>${r.date ? esc(longDate(r.date)) : 'Без даты'}</span><span class="num">${nice(r.weight)} кг${hasReps(r) ? ' × ' + esc(r.reps) : ''}</span></button>`).join('')}</section><p class="note">Записи журнала из прошлой версии. В график не входят.</p>`;
}

const discussButton = weightId => weightId ? `<button class="btn block" data-action="discussExercise" data-id="${esc(weightId)}">Обсудить прогресс с ИИ</button>` : '';

export function exercisePage(day, slotId) {
  const workout = activeWorkoutOf(data(), day), slot = findSlot(workout, slotId), template = slotOf(data(), day, slotId);
  const variant = slot ? selectedVariant(slot) : template, main = slot ? mainVariant(slot) : template, weightId = variant.weightId;
  let today = '';
  if (slot) {
    const status = slotStatus(data(), workout, slot), others = slot.variants.filter(v => v.id !== variant.id && setsOf(slot, v.id).length);
    today = `<section class="card">${findItem(data(), weightId)?.note ? `<p class="personal-note">${esc(findItem(data(), weightId).note)}</p>` : ''}<div class="row"><h2>Сегодня</h2><span class="status-pill s-${status}">${STATUS_TEXT[status]}</span></div>
      ${setChips(workout, slot, variant.id) || '<p class="note">Подходов пока нет.</p>'}
      ${others.map(v => `<p class="note">Также: ${esc(v.name)} — ${setsText(setsOf(slot, v.id))}</p>`).join('')}
      ${isOpen(workout, slot, variant.id) ? quickRow(workout, slot, variant.id, 'completeAndBack') : `<div class="exercise-actions"><button class="btn small primary" data-action="addSet" data-workout="${esc(workout.id)}" data-slot="${esc(slot.id)}" data-variant="${esc(variant.id)}">+ Подход</button><button class="btn small primary" data-action="completeAndBack" data-id="${esc(slot.id)}">Завершить упражнение</button></div>`}</section>`;
  }
  return `<h1 class="wrap">${esc(variant.name)}</h1><p class="lede">${dayTitle(day)}${variant.id !== main.id ? ' · вместо: ' + esc(main.name) : ''} · ${variant.sets ?? main.sets} × ${esc(variant.range ?? main.range)}</p>
    ${weightId ? `<div class="exercise-tools"><button class="btn small" data-action="openTechnique" data-id="${esc(weightId)}">Техника</button></div>` : ''}${lastTimeCard(weightId, workout?.id)}${today}${chartCard(weightId)}${historyBlock(weightId)}${legacyRecords(weightId)}${discussButton(weightId)}`;
}

export function itemPage(itemId) {
  const item = findItem(data(), itemId);
  if (!item) return '<div class="empty">Упражнение не найдено.</div>';
  const group = data().groups.find(g => g.items.includes(item));
  return `<h1 class="wrap">${esc(item.name)}</h1><p class="lede">${esc(group?.name || '')} · ${EQUIPMENT[item.equipment] || 'Оборудование не указано'}${item.archived ? ' · В архиве' : ''}</p><div class="footer-actions exercise-tools"><button class="btn small" data-action="catalogFavorite" data-id="${esc(item.id)}" aria-pressed="${item.favorite}">${item.favorite ? 'В избранном' : 'В избранное'}</button><button class="btn small" data-action="catalogEditExercise" data-id="${esc(item.id)}">Свойства</button><button class="btn small" data-action="openTechnique" data-id="${esc(item.id)}">Техника</button><button class="btn small" data-action="archiveCatalogItem" data-id="${esc(item.id)}">${item.archived ? 'Восстановить' : 'В архив'}</button></div><section class="card"><h2>Моя заметка</h2><p class="personal-note">${item.note ? esc(item.note) : 'Добавьте личные настройки в свойствах упражнения.'}</p></section>${itemUsage(data(), item.id).length ? `<section class="card"><h2>Используется</h2>${itemUsage(data(), item.id).map(u => `<button class="btn small" data-action="openWorkout" data-day="${u.day}">${dayTitle(u.day)}${u.active ? ' · занятие' : ' · программа'}</button>`).join('')}</section>` : ''}${lastTimeCard(item.id)}${chartCard(item.id)}${historyBlock(item.id)}${legacyRecords(item.id)}${discussButton(item.id)}`;
}

export const actions = {
  archiveCatalogItem: async ({ id }) => {
    const item = findItem(data(), id);
    if (!item) return;
    if (!item.archived && itemUsage(data(), id).length) return alert('Сначала уберите упражнение из программы или завершите активное занятие. Места использования показаны на этой странице.');
    if (item.archived || await ds.confirm('В архив?', 'История, заметка и техника сохранятся.', { ok: 'В архив' })) { if (applied(ctx.uc.archiveItem(id, !item.archived))) ctx.render(); }
  },
  // Saves a correct open draft, completes the slot and returns to the list; on error stays here.
  completeAndBack: ({ id }) => {
    const workout = activeWorkoutOf(data(), data().tab);
    if (!workout || !applied(ctx.uc.completeSlot(workout.id, id))) return;
    view.draft = null;
    go(workout.day);
  },
  editRecord: ({ group, id, record }) => { view.modal = { type: 'record', group, id, recordId: record }; ctx.render(); },
  openItem: ({ id, from }) => { view.itemParent = from || 'exercises'; go('item', id); },
  discussExercise: ({ id }) => {
    const name = findItem(data(), id)?.name || 'упражнение';
    discuss({ kind: 'exercise', weightId: id, label: name }, `Как идёт мой прогресс в упражнении «${name}»? На что обратить внимание?`);
  },
};
