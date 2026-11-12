// Exercise note sheet: one textarea, Save / Cancel side by side. State: view.modal = {type: 'note', id (catalog item), dirty}.
// The note lives on the catalog item, so every card of the same exercise shows it.
import { findItem } from '../../domain/catalog.js';
import { ctx, view, data, applied, rerender } from '../context.js';
import { esc } from '../format.js';

export function noteHtml() {
  const item = findItem(data(), view.modal.id);
  if (!item) return '';
  return `<dialog class="modal technique-modal" aria-labelledby="noteTitle"><section class="card catalog-shell technique-shell"><div class="catalog-content technique-content note-content"><h2 class="technique-title" id="noteTitle">${esc(item.name)}</h2><form id="noteForm"><textarea class="note-input" name="note" maxlength="4000" placeholder="Наклон скамьи, положение сиденья, хват…" aria-label="Заметки">${esc(item.note)}</textarea></form></div><footer class="sheet-footer split"><button class="btn primary" type="submit" form="noteForm">Сохранить</button><button class="btn" type="button" data-action="close">Отмена</button></footer></section></dialog>`;
}

export const actions = {
  openNote: ({ id }) => { if (findItem(data(), id)) { view.modal = { type: 'note', id, dirty: false }; ctx.render(); } },
};

export const listeners = [
  ['input', ev => { if (ev.target.closest('#noteForm') && view.modal?.type === 'note') view.modal.dirty = true; }],
  ['submit', ev => {
    if (ev.target.id !== 'noteForm') return;
    ev.preventDefault();
    if (!applied(ctx.uc.saveNote(view.modal.id, new FormData(ev.target).get('note').trimEnd()))) return;
    view.modal = null;
    rerender();
  }],
];
