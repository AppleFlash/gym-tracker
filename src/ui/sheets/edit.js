// Edit sheet: a saved set of any workout ('set'), a program exercise's plan ('day'),
// or a record of the legacy weight journal ('record', corrections only).
import { groupItem, findItem } from '../../domain/catalog.js';
import { findVariant } from '../../domain/program.js';
import { findWorkout, findSlot, setsOf } from '../../domain/workout.js';
import { ctx, view, data, applied, rerender } from '../context.js';
import { esc, helpButton } from '../format.js';
import { go } from '../router.js';

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
      + field('reps', 'Повторы', s?.reps ?? '', 'text', false, 'inputmode="numeric" pattern="[0-9]*"');
  }
  if (m.type === 'record') {
    const r = recordOf(m);
    title = 'Запись журнала';
    removable = !!r;
    body = field('weight', 'Вес, кг', r?.weight ?? '', 'text', false, 'inputmode="decimal"') + field('reps', 'Повторения (можно диапазон)', r?.reps ?? '', 'text', false, 'inputmode="decimal"') + field('date', 'Дата', r?.date ?? '', 'date', true)
      + `<label class="pill"><input name="up" type="checkbox" ${r?.up ? 'checked' : ''}> ↑ Увеличить вес в следующий раз</label>`;
  }
  if (m.type === 'day') {
    const e = findVariant(data(), m.day, m.id);
    title = 'Параметры упражнения';
    removable = !!e;
    body = `<div class="field wide"><strong>${esc(findItem(data(), e?.weightId)?.name || e?.name)}</strong></div>` + field('sets', 'Подходы', e?.sets, 'number', false, 'step="1" min="1" inputmode="numeric"') + field('range', 'Повторения, например 8–12', e?.range);
  }
  return `<dialog class="modal"><section class="card"><div class="sheet-nav"><div class="nav-side"></div><h2 class="sheet-title">${title}</h2><div class="nav-side end"><button type="button" class="nav-action" data-action="close">Закрыть</button></div></div><form id="editForm"><div class="form-grid" style="margin-top:14px">${body}</div><div class="form-actions"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-action="close">Отмена</button>${removable ? '<button class="btn danger" type="button" data-action="removeModal">Удалить</button>' : ''}</div></form></section></dialog>`;
}

export function closeSheet() {
  view.modal = null;
  rerender();
}

const REMOVE_QUESTION = { set: 'Удалить подход?', record: 'Удалить запись журнала?', day: 'Удалить упражнение из программы? Упражнение останется в базе вместе с историей.' };

export const actions = {
  close: closeSheet,
  removeModal: async () => {
    const m = view.modal;
    if (!m || !await ds.confirm(REMOVE_QUESTION[m.type], '', { ok: 'Удалить', destructive: true })) return;
    const result = m.type === 'set' ? ctx.uc.removeSet(...setRef(m))
      : m.type === 'record' ? ctx.uc.removeRecord({ group: m.group, id: m.id, recordId: m.recordId })
      : ctx.uc.removeFromProgram(m.day, m.id);
    if (!applied(result)) return;
    view.modal = null;
    // The exercise screen of a removed program exercise no longer exists.
    if (m.type === 'day' && view.exerciseId === m.id) return go(m.day);
    rerender();
  },
};

export const listeners = [
  ['submit', ev => {
    if (ev.target.id !== 'editForm') return;
    ev.preventDefault();
    const m = view.modal, form = new FormData(ev.target);
    const result = m.type === 'set' ? ctx.uc.updateSet(...setRef(m), { weight: form.get('weight'), reps: form.get('reps') })
      : m.type === 'record' ? ctx.uc.saveRecord({ group: m.group, id: m.id, recordId: m.recordId }, { weight: form.get('weight'), reps: form.get('reps'), date: form.get('date'), up: form.has('up') })
      : ctx.uc.setExerciseParams(m.day, m.id, { sets: Number(form.get('sets')), range: form.get('range') });
    if (result?.error) return alert(result.error);
    closeSheet();
  }],
];
