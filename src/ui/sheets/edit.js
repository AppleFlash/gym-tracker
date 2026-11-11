// Edit a saved workout set or a legacy journal record.
import { groupItem } from '../../domain/catalog.js';
import { findWorkout, findSlot, setsOf } from '../../domain/workout.js';
import { dumbbellHint } from '../sets.js';
import { ctx, view, data, applied, rerender } from '../context.js';
import { esc, helpButton } from '../format.js';
import { discardForm } from './catalog.js';

const field = (name, label, value = '', type = 'text', wide = false, mode = '') =>
  `<label class="field ${wide ? 'wide' : ''}">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${mode} autocomplete="off"></label>`;
const recordOf = m => groupItem(data(), m.group, m.id)?.records.find(r => r.id === m.recordId);
const setOf = m => setsOf(findSlot(findWorkout(data(), m.workoutId), m.slotId) || { performed: {} }, m.variantId).find(s => s.id === m.setId);
const setRef = m => [m.workoutId, m.slotId, m.variantId, m.setId];

export function editSheetHtml() {
  const m = view.modal;
  let title = '', body = '', removable = false;
  if (m.type === 'set') {
    const s = setOf(m), variant = findSlot(findWorkout(data(), m.workoutId), m.slotId)?.variants.find(v => v.id === m.variantId);
    title = 'Подход';
    removable = !!s;
    body = `<div class="field wide"><strong>${esc(variant?.name || '')}</strong></div>`
      + `<label class="field">Вес, кг ${helpButton('weightHelp', 'Как вводить вес')}<input name="weight" value="${esc(s?.weight ?? '')}" inputmode="decimal" autocomplete="off"></label>`
      + field('reps', 'Повторы', s?.reps ?? '', 'text', false, 'inputmode="numeric" pattern="[0-9]*"') + dumbbellHint(variant);
  }
  if (m.type === 'record') {
    const r = recordOf(m);
    title = 'Запись журнала';
    removable = !!r;
    body = field('weight', 'Вес, кг', r?.weight ?? '', 'text', false, 'inputmode="decimal"') + field('reps', 'Повторения (можно диапазон)', r?.reps ?? '', 'text', false, 'inputmode="decimal"') + field('date', 'Дата', r?.date ?? '', 'date', true)
      + `<label class="pill"><input name="up" type="checkbox" ${r?.up ? 'checked' : ''}> ↑ Увеличить вес в следующий раз</label>`;
  }
  return `<dialog class="modal"><section class="card"><div class="sheet-nav"><div class="nav-side"></div><h2 class="sheet-title">${title}</h2><div class="nav-side end"><button type="button" class="nav-action" data-action="close">Закрыть</button></div></div><form id="editForm"><div class="form-grid" style="margin-top:14px">${body}</div><div class="form-actions"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-action="close">Отмена</button>${removable ? '<button class="btn danger" type="button" data-action="removeModal">Удалить</button>' : ''}</div></form></section></dialog>`;
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
  ['submit', ev => {
    if (ev.target.id !== 'editForm') return;
    ev.preventDefault();
    const m = view.modal, form = new FormData(ev.target);
    const result = m.type === 'set' ? ctx.uc.updateSet(...setRef(m), { weight: form.get('weight'), reps: form.get('reps') })
      : ctx.uc.saveRecord({ group: m.group, id: m.id, recordId: m.recordId }, { weight: form.get('weight'), reps: form.get('reps'), date: form.get('date'), up: form.has('up') });
    if (result?.error) return alert(result.error);
    closeSheet();
  }],
];
