// Set entry form behaviour (component: ui/components/set-entry.js) and saved sets as tappable chips.
// Typing is saved as a draft on every keystroke, so switching cards, screens or closing the app loses nothing.
import { draftRow, setsOf, loadFactor } from '../domain/workout.js';
import { ctx, view, data, applied, rerender } from './context.js';
import { esc, nice } from './format.js';

const ENTRY = '.set-entry';
const refAttrs = (workout, slot, variantId) => `data-workout="${esc(workout.id)}" data-slot="${esc(slot.id)}" data-variant="${esc(variantId)}"`;
// Dumbbell exercises take the weight of one dumbbell.
export const dumbbellHint = variant => loadFactor(data(), variant?.weightId) === 2 ? '<p class="qs-hint">Укажите вес гантели</p>' : '';

export function setChips(workout, slot, variantId) {
  const sets = setsOf(slot, variantId);
  return sets.length ? `<div class="set-chips">${sets.map((s, i) => `<button type="button" class="set-chip" data-action="editSet" ${refAttrs(workout, slot, variantId)} data-set="${esc(s.id)}" aria-label="Подход ${i + 1}: ${nice(s.weight)} кг, ${s.reps} повторений. Изменить"><b>${nice(s.weight)}</b>×${s.reps}</button>`).join('')}</div>` : '';
}

export const actions = {
  editSet: ({ workout, slot, variant, set }) => { view.modal = { type: 'set', workoutId: workout, slotId: slot, variantId: variant, setId: set }; ctx.render(); },
  weightHelp: () => ds.alert({ title: 'Как вводить вес', message: 'Для упражнений с оборудованием «Гантели» вводите вес одной гантели: в объёме он считается дважды. Для остальных — вес на снаряде или в тренажёре. Для упражнений без отягощения укажите 0: повторы сохранятся, объём не изменится.', actions: [{ label: 'Понятно', value: true, style: 'default', cancel: true }] }),
};

export const listeners = [
  ['input', ev => {
    const field = ev.target.dataset.draftField, form = ev.target.closest(ENTRY);
    if (!field || !form) return;
    const { workout, slot, variant } = form.dataset;
    if (!draftRow(data(), workout, slot, variant)) ctx.uc.openDraft(workout, slot, variant); // card forms store the draft on first input
    ctx.uc.editDraft(workout, slot, variant, field, ev.target.value);
  }],
  // Enter in the weight field moves on to reps instead of submitting half a set.
  ['keydown', ev => {
    if (ev.key === 'Enter' && ev.target.dataset.draftField === 'weight') { ev.preventDefault(); ev.target.closest(ENTRY).querySelector('[data-draft-field="reps"]').focus(); }
  }],
  ['submit', ev => {
    const form = ev.target;
    if (!form.matches(ENTRY)) return;
    ev.preventDefault();
    const { workout, slot, variant } = form.dataset, value = name => form.querySelector(`[data-draft-field="${name}"]`).value;
    if (!applied(ctx.uc.saveSet(workout, slot, variant, { weight: value('weight'), reps: value('reps') }))) return;
    rerender();
  }],
];
