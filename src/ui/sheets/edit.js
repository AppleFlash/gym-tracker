// Edit a saved workout set or a legacy journal record.
import { groupItem } from '../../domain/catalog.js';
import { findWorkout, findSlot, setsOf } from '../../domain/workout.js';
import { dumbbellHint } from '../sets.js';
import { ctx, view, data, applied, rerender } from '../context.js';
import { esc, helpButton } from '../format.js';
import { discardForm } from './catalog.js';

const recordOf = m => groupItem(data(), m.group, m.id)?.records.find(r => r.id === m.recordId);
const setOf = m => setsOf(findSlot(findWorkout(data(), m.workoutId), m.slotId) || { performed: {} }, m.variantId).find(s => s.id === m.setId);
const setRef = m => [m.workoutId, m.slotId, m.variantId, m.setId];

// Weight and reps share one look in both sheets: label inside the field, numbers in tabular figures.
const qsField = (id, name, label, value, mode, help = '') =>
  `<div class="qs-field"><label for="${id}">${label}</label>${help}<input id="${id}" name="${name}" value="${esc(value)}" ${mode} autocomplete="off"></div>`;

// Same layout as the note sheet: title, fields, a quiet delete row, pinned Save | Cancel. State: view.modal = {type: 'set'|'record', ..., dirty}.
export function editSheetHtml() {
  const m = view.modal;
  let title = '', intro = '', body = '', removeLabel = '';
  if (m.type === 'set') {
    const s = setOf(m), variant = findSlot(findWorkout(data(), m.workoutId), m.slotId)?.variants.find(v => v.id === m.variantId);
    title = 'Подход';
    intro = variant?.name || '';
    if (s) removeLabel = 'Удалить подход';
    body = `<div class="qs-grid">${qsField('ed-weight', 'weight', 'Вес, кг', s?.weight ?? '', 'inputmode="decimal"', helpButton('weightHelp', 'Как вводить вес'))}${qsField('ed-reps', 'reps', 'Повторы', s?.reps ?? '', 'inputmode="numeric" pattern="[0-9]*"')}${dumbbellHint(variant)}</div>`;
  }
  if (m.type === 'record') {
    const r = recordOf(m);
    title = 'Запись журнала';
    if (r) removeLabel = 'Удалить запись';
    body = `<div class="qs-grid">${qsField('ed-weight', 'weight', 'Вес, кг', r?.weight ?? '', 'inputmode="decimal"')}${qsField('ed-reps', 'reps', 'Повторения', r?.reps ?? '', 'inputmode="decimal"')}</div>`
      + `<label class="field edit-date">Дата<input name="date" type="date" value="${esc(r?.date ?? '')}" autocomplete="off"></label>`
      + `<label class="pill"><input name="up" type="checkbox" ${r?.up ? 'checked' : ''}> ↑ Увеличить вес в следующий раз</label>`;
  }
  return `<dialog class="modal technique-modal" aria-labelledby="editTitle"><section class="card catalog-shell technique-shell"><div class="catalog-content technique-content"><h2 class="technique-title" id="editTitle">${title}</h2>${intro ? `<p class="technique-intro">${esc(intro)}</p>` : ''}<form id="editForm">${body}</form>${removeLabel ? `<button type="button" class="edit-remove" data-action="removeModal">${removeLabel}</button>` : ''}</div><footer class="sheet-footer split"><button class="btn primary" type="submit" form="editForm">Сохранить</button><button class="btn" type="button" data-action="close">Отмена</button></footer></section></dialog>`;
}

export function closeSheet() {
  if (view.modal?.dirty) {
    document.querySelector('#app dialog.modal')?.style.removeProperty('transform');
    const m = view.modal;
    discardForm(m).then(ok => { if (ok && view.modal === m) { view.modal = null; rerender(); } });
    return;
  }
  view.modal = null;
  rerender();
}

const REMOVE_QUESTION = { set: 'Удалить подход?', record: 'Удалить запись журнала?' };

export const actions = {
  close: closeSheet,
  removeModal: async () => {
    const m = view.modal;
    if (!m || !await ds.confirm(REMOVE_QUESTION[m.type], '', { ok: 'Удалить', destructive: true })) return;
    const result = m.type === 'set' ? ctx.uc.removeSet(...setRef(m))
      : ctx.uc.removeRecord({ group: m.group, id: m.id, recordId: m.recordId });
    if (!applied(result)) return;
    view.modal = null;
    rerender();
  },
};

export const listeners = [
  ['input', ev => { if (ev.target.closest('#editForm') && view.modal) view.modal.dirty = true; }],
  ['submit', ev => {
    if (ev.target.id !== 'editForm') return;
    ev.preventDefault();
    const m = view.modal, form = new FormData(ev.target);
    const result = m.type === 'set' ? ctx.uc.updateSet(...setRef(m), { weight: form.get('weight'), reps: form.get('reps') })
      : ctx.uc.saveRecord({ group: m.group, id: m.id, recordId: m.recordId }, { weight: form.get('weight'), reps: form.get('reps'), date: form.get('date'), up: form.has('up') });
    if (result?.error) return alert(result.error);
    m.dirty = false;
    closeSheet();
  }],
];
