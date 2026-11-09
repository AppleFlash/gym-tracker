// "Replace exercise" sheet: the main exercise and saved alternatives with their last result.
// During a workout one tap picks a variant for this workout only; without one it manages the template's alternatives.
// State: view.modal = {type: 'variants', day, slotId}.
import { slotOf, variantsOf } from '../../domain/program.js';
import { activeWorkoutOf, findSlot, lastPerformance, setsOf } from '../../domain/workout.js';
import { ctx, view, data, applied, rerender } from '../context.js';
import { esc, shortDate, setsText, plural, SETS, trashIcon } from '../format.js';
import { openCatalog } from './catalog.js';

const lastResult = (weightId, exceptId) => {
  const last = lastPerformance(data(), weightId, exceptId);
  return last ? `Прошлый раз ${esc(shortDate(last.workout.date))}: ${setsText(last.sets)}` : 'Ещё не выполнялось';
};

export function variantsHtml() {
  const m = view.modal, workout = activeWorkoutOf(data(), m.day), slot = findSlot(workout, m.slotId), template = slotOf(data(), m.day, m.slotId);
  const variants = slot ? slot.variants : template ? variantsOf(template) : [], main = variants[0];
  const rows = variants.map((v, i) => {
    const today = slot ? setsOf(slot, v.id).length : 0, chosen = slot?.selectedId === v.id;
    const meta = `${i ? 'Альтернатива' : 'Основное'} · ${lastResult(v.weightId, workout?.id)}${today ? ` · сегодня ${plural(today, SETS)}` : ''}`;
    const body = `<span class="variant-body"><strong>${esc(v.name)}</strong><small>${meta}</small></span>`;
    if (slot) return `<button class="variant-row" data-action="pickVariant" data-id="${esc(v.id)}" aria-pressed="${chosen}">${body}<span class="variant-check" aria-hidden="true">${chosen ? '✓' : ''}</span></button>`;
    return `<div class="variant-row">${body}${i && template?.alternatives?.some(a => a.id === v.id) ? `<button class="icon-btn" data-action="removeAlternative" data-id="${esc(v.id)}" aria-label="Удалить альтернативу «${esc(v.name)}» из программы">${trashIcon}</button>` : ''}</div>`;
  }).join('');
  return `<dialog class="modal" aria-labelledby="variantsTitle"><section class="card"><div class="sheet-nav"><div class="nav-side"></div><h2 class="sheet-title" id="variantsTitle">${slot ? 'Замена упражнения' : 'Альтернативы'}</h2><div class="nav-side end"><button type="button" class="nav-action" data-action="close">Закрыть</button></div></div>
    <p class="lede">${esc(main?.name || '')}</p>
    <div class="card list variant-list">${rows}</div>
    ${template ? '<button class="btn block" data-action="addAlternativeFromSheet">+ Добавить альтернативу</button>' : ''}
    <p class="note">${slot ? 'Выбор действует только в этой тренировке. Подходы каждого варианта сохраняются отдельно.' : 'Альтернативы сохраняются в программе. Каждая тренировка начинается с основного упражнения.'}</p>
  </section></dialog>`;
}

export const actions = {
  pickVariant: ({ id }) => {
    const m = view.modal, workout = activeWorkoutOf(data(), m?.day);
    if (!workout) return;
    const result = ctx.uc.selectVariant(workout.id, m.slotId, id);
    if (result && !applied(result)) return;
    view.modal = null;
    if (view.draft?.slotId === m.slotId) view.draft = null;
    rerender();
  },
  addAlternativeFromSheet: () => { const m = view.modal; openCatalog(m.day, m.slotId); },
  removeAlternative: async ({ id }) => {
    const m = view.modal;
    if (!await ds.confirm('Удалить альтернативу?', 'Она пропадёт из этой программы. Упражнение останется в базе вместе с историей.', { ok: 'Удалить', destructive: true })) return;
    if (applied(ctx.uc.removeFromProgram(m.day, id))) rerender();
  },
};
