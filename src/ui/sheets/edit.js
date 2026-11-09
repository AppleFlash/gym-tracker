// Edit sheet for a weight record (view.modal.type 'record') or a program exercise's sets/reps ('day').
import { groupItem, findItem } from '../../domain/catalog.js';
import { findVariant } from '../../domain/program.js';
import { ctx, view, data, applied } from '../context.js';
import { esc } from '../format.js';

const field = (name, label, value = '', type = 'text', wide = false) => {
  const mode = name === 'weight' || name === 'reps' ? 'inputmode="decimal"' : type === 'number' ? 'step="any" min="0" inputmode="numeric"' : '';
  return `<label class="field ${wide ? 'wide' : ''}">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${mode}></label>`;
};
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const recordOf = m => groupItem(data(), m.group, m.id)?.records.find(r => r.id === m.recordId);

export function editSheetHtml() {
  const m = view.modal;
  let title = '', body = '', removable = false;
  if (m.type === 'record') {
    const r = recordOf(m);
    title = r ? 'Изменить запись' : 'Новая запись';
    removable = !!r;
    body = field('weight', 'Вес, кг', r?.weight ?? '') + field('reps', 'Повторения (можно диапазон)', r?.reps ?? '') + field('date', 'Дата', r?.date ?? today(), 'date', true)
      + `<label class="pill"><input name="up" type="checkbox" ${r?.up ? 'checked' : ''}> ↑ Увеличить вес в следующий раз</label>`;
  }
  if (m.type === 'day') {
    const e = findVariant(data(), m.day, m.id);
    title = 'Параметры упражнения';
    removable = !!e;
    body = `<div class="field wide"><strong>${esc(findItem(data(), e?.weightId)?.name || e?.name)}</strong></div>` + field('sets', 'Подходы', e?.sets, 'number') + field('range', 'Повторения, например 8–12', e?.range);
  }
  return `<dialog class="modal"><section class="card"><div class="sheet-nav"><div class="nav-side"></div><h2 class="sheet-title">${title}</h2><div class="nav-side end"><button type="button" class="nav-action" data-action="close">Закрыть</button></div></div><form id="editForm"><div class="form-grid" style="margin-top:14px">${body}</div><div class="form-actions"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-action="close">Отмена</button>${removable ? '<button class="btn danger" type="button" data-action="removeModal">Удалить</button>' : ''}</div></form></section></dialog>`;
}

export function closeSheet() {
  view.modal = null;
  ctx.render();
}

export const actions = {
  close: closeSheet,
  removeModal: () => {
    const m = view.modal;
    if (!m || !confirm(m.type === 'record' ? 'Удалить запись?' : 'Удалить упражнение?')) return;
    if (m.type === 'record') applied(ctx.uc.removeRecord({ group: m.group, id: m.id, recordId: m.recordId }));
    if (m.type === 'day' && applied(ctx.uc.removeFromProgram(m.day, m.id))) view.exerciseId = null;
    closeSheet();
  },
};

export const listeners = [
  ['submit', ev => {
    if (ev.target.id !== 'editForm') return;
    ev.preventDefault();
    const m = view.modal, form = new FormData(ev.target);
    const result = m.type === 'record'
      ? ctx.uc.saveRecord({ group: m.group, id: m.id, recordId: m.recordId }, { weight: form.get('weight'), reps: form.get('reps'), date: form.get('date'), up: form.has('up') })
      : ctx.uc.setExerciseParams(m.day, m.id, { sets: Number(form.get('sets')), range: form.get('range') });
    if (result?.error) return alert(result.error);
    closeSheet();
  }],
];
