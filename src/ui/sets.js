// Quick set entry: one inline row (weight, reps, save, cancel) for the open draft, and saved sets as tappable chips.
// Typing is saved as a draft on every keystroke, so switching cards, screens or closing the app loses nothing.
import { draftRow, setsOf } from '../domain/workout.js';
import { ctx, view, data, applied, rerender } from './context.js';
import { esc, nice, helpButton } from './format.js';

const refAttrs = (workout, slot, variantId) => `data-workout="${esc(workout.id)}" data-slot="${esc(slot.id)}" data-variant="${esc(variantId)}"`;
export const isOpen = (workout, slot, variantId) => view.draft?.workoutId === workout.id && view.draft.slotId === slot.id && view.draft.variantId === variantId;

export function setChips(workout, slot, variantId) {
  const sets = setsOf(slot, variantId);
  return sets.length ? `<div class="set-chips">${sets.map((s, i) => `<button type="button" class="set-chip" data-action="editSet" ${refAttrs(workout, slot, variantId)} data-set="${esc(s.id)}" aria-label="Подход ${i + 1}: ${nice(s.weight)} кг, ${s.reps} повторений. Изменить"><b>${nice(s.weight)}</b>×${s.reps}</button>`).join('')}</div>` : '';
}

export function quickRow(workout, slot, variantId, completeAction = null) {
  const row = draftRow(data(), workout.id, slot.id, variantId) || { weight: '', reps: '' }, n = setsOf(slot, variantId).length + 1;
  return `<form class="quick-set ${completeAction ? 'with-complete' : ''}" ${refAttrs(workout, slot, variantId)}>
    <div class="qs-field"><label for="qs-weight">Вес, кг</label>${helpButton('weightHelp', 'Как вводить вес')}<input id="qs-weight" data-draft-field="weight" inputmode="decimal" autocomplete="off" enterkeyhint="next" value="${esc(row.weight)}" placeholder="0" aria-label="Вес подхода ${n}, кг"></div>
    <div class="qs-field"><label for="qs-reps">Повторы</label><input id="qs-reps" data-draft-field="reps" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="done" value="${esc(row.reps)}" placeholder="8" aria-label="Повторения подхода ${n}"></div>
    <div class="qs-actions"><button type="submit" class="btn primary small">Сохранить</button>${completeAction ? `<button type="button" class="btn primary small" data-action="${completeAction}" data-id="${esc(slot.id)}" aria-label="Завершить упражнение">Завершить</button>` : ''}<button type="button" class="btn small" data-action="cancelSet">Отмена</button></div>
  </form>`;
}

// A closed but filled draft stays visible so it is never forgotten.
export function draftHint(workout, slot, variantId) {
  const row = draftRow(data(), workout.id, slot.id, variantId);
  if (!row || isOpen(workout, slot, variantId) || (String(row.weight).trim() === '' && String(row.reps).trim() === '')) return '';
  return `<button type="button" class="draft-hint" data-action="addSet" ${refAttrs(workout, slot, variantId)}>Черновик: ${esc(row.weight || '—')} × ${esc(row.reps || '—')}. Продолжить ввод</button>`;
}

// Opens (and prefills) the draft row, then focuses the weight field.
export function openRow(workoutId, slotId, variantId) {
  const result = ctx.uc.openDraft(workoutId, slotId, variantId);
  if (result?.error) return applied(result);
  view.draft = { workoutId, slotId, variantId };
  rerender();
  const input = document.querySelector('.quick-set [data-draft-field="weight"]');
  input?.focus({ preventScroll: true });
  input?.scrollIntoView({ block: 'nearest' });
  input?.select();
}

export const actions = {
  addSet: ({ workout, slot, variant }) => openRow(workout, slot, variant),
  cancelSet: () => {
    if (!view.draft) return;
    const { workoutId, slotId, variantId } = view.draft;
    if (!applied(ctx.uc.cancelDraft(workoutId, slotId, variantId))) return;
    view.draft = null;
    rerender();
  },
  editSet: ({ workout, slot, variant, set }) => { view.modal = { type: 'set', workoutId: workout, slotId: slot, variantId: variant, setId: set }; ctx.render(); },
  weightHelp: () => ds.alert({ title: 'Как вводить вес', message: 'Вводите суммарный внешний вес: две гантели по 20 кг — это 40 кг. Для упражнений без отягощения укажите 0: повторы сохранятся, объём не изменится.', actions: [{ label: 'Понятно', value: true, style: 'default', cancel: true }] }),
};

export const listeners = [
  ['input', ev => {
    const field = ev.target.dataset.draftField, form = ev.target.closest('.quick-set');
    if (field && form) ctx.uc.editDraft(form.dataset.workout, form.dataset.slot, form.dataset.variant, field, ev.target.value);
  }],
  // Enter in the weight field moves on to reps instead of submitting half a set.
  ['keydown', ev => {
    if (ev.key === 'Enter' && ev.target.dataset.draftField === 'weight') { ev.preventDefault(); ev.target.closest('.quick-set').querySelector('[data-draft-field="reps"]').focus(); }
  }],
  ['submit', ev => {
    const form = ev.target;
    if (!form.matches('.quick-set')) return;
    ev.preventDefault();
    const { workout, slot, variant } = form.dataset, value = name => form.querySelector(`[data-draft-field="${name}"]`).value;
    if (!applied(ctx.uc.saveSet(workout, slot, variant, { weight: value('weight'), reps: value('reps') }))) return;
    view.draft = null;
    rerender();
  }],
];
