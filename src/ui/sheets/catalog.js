// Catalog sheet: context selection, exercise properties and user groups.
import { findItem, itemGroup, catalogItems, searchKey } from '../../domain/catalog.js';
import { slotOf, alternativeGroup } from '../../domain/program.js';
import { ctx, view, data, applied, rerender } from '../context.js';
import { esc, chevron, dayLetter } from '../format.js';
import { catalogBrowser, emptyFilters, catalogState, groupOptions, equipmentOptions } from '../catalog-list.js';

export function openCatalog(day = null, parentId = null) {
  const slot = parentId && slotOf(data(), day, parentId);
  view.modal = { type: 'catalog', day, parentId, filters: { ...emptyFilters(), group: slot ? itemGroup(data(), slot.weightId)?.id || '' : '' }, editing: null, form: null, dirty: false };
  ctx.render();
}
export const catalogDepth = m => m.editing ? 1 : 0;
export async function discardForm(m = view.modal) {
  return !m?.dirty || await ds.confirm('Отменить изменения?', 'Несохранённый ввод будет потерян.', { ok: 'Не сохранять', destructive: true });
}
function similarHtml(m) {
  const q = searchKey(m.form.name || '');
  const locked = m.parentId ? alternativeGroup(data(), m.day, m.parentId)?.id : null;
  const matches = q ? catalogItems(data()).filter(i => (!locked || itemGroup(data(), i.id)?.id === locked) && i.id !== m.editing.id && (searchKey(i.name).includes(q) || i.aliases.some(a => searchKey(a).includes(q)))) : [];
  return matches.length ? '<p class="note">Похожие упражнения уже есть:</p>' + matches.slice(0, 8).map(i => `<button type="button" class="btn small" data-action="catalogUseSimilar" data-id="${esc(i.id)}">${esc(i.name)}${i.archived ? ' · в архиве' : ''}</button>`).join('') : '';
}
function editForm(m) {
  const f = m.form, group = m.editing.kind === 'group';
  return `<form id="catalogForm"><h2>${group ? 'Новая группа мышц' : m.editing.id ? 'Свойства упражнения' : 'Новое упражнение'}</h2>
    <label class="field">Название<input name="name" value="${esc(f.name)}" maxlength="200" required autocomplete="off"></label>
    ${group ? '' : `<div class="form-grid"><label class="field">Группа мышц<select name="groupId" required>${groupOptions(f.groupId, m.parentId && !m.editing.id ? alternativeGroup(data(), m.day, m.parentId)?.id : null)}</select></label><label class="field">Оборудование<select name="equipment">${equipmentOptions(f.equipment)}</select></label></div>
    <label class="field">Другие названия, по одному в строке<textarea name="aliases" rows="2" maxlength="4020">${esc(f.aliases)}</textarea></label>
    <label class="field">Моя заметка<textarea name="note" rows="3" maxlength="4000" placeholder="Наклон скамьи, положение сиденья, хват…">${esc(f.note)}</textarea></label><div class="catalog-similar">${similarHtml(m)}</div>`}
    <div class="form-actions"><button class="btn primary" type="submit">${!group && !m.editing.id && m.day ? 'Создать и добавить' : 'Сохранить'}</button><button class="btn" type="button" data-action="catalogCancelEdit">Отмена</button></div></form>`;
}
export function catalogHtml() {
  const m = view.modal, context = m.day ? m.parentId ? 'Альтернатива для ' + (slotOf(data(), m.day, m.parentId)?.name || 'упражнения') : 'Добавить в тренировку ' + dayLetter(m.day) : 'Упражнения и свойства';
  return `<dialog class="modal catalog-modal" aria-labelledby="catalogTitle"><section class="card catalog-shell"><div class="sheet-nav catalog-header"><div class="nav-side">${m.editing ? `<button class="nav-back" data-action="catalogCancelEdit" aria-label="Назад">${chevron}</button>` : ''}</div><h2 class="sheet-title" id="catalogTitle">База упражнений</h2><div class="nav-side end"><button class="nav-action" data-action="close">Закрыть</button></div></div><div class="catalog-content"><p class="lede">${esc(context)}</p>${m.editing ? editForm(m) : catalogBrowser('sheet')}</div></section></dialog>`;
}
function beginEdit(id = null, scope = 'sheet', groupId = null) {
  if (scope === 'page' || view.modal?.type !== 'catalog') view.modal = { type: 'catalog', day: null, parentId: null, filters: { ...catalogState('page') }, editing: null };
  const m = view.modal, item = id ? findItem(data(), id) : null;
  m.listScroll = document.querySelector('.catalog-content')?.scrollTop || 0;
  m.editing = { kind: 'exercise', id };
  m.form = { name: item?.name || m.filters.query.trim(), groupId: item ? itemGroup(data(), id)?.id : groupId || m.filters.group || data().groups[0]?.id || '', equipment: item?.equipment || '', aliases: item?.aliases.join('\n') || '', note: item?.note || '' };
  m.dirty = false; ctx.render();
}
function pick(id) {
  const m = view.modal, item = findItem(data(), id);
  if (!item || item.archived || !m?.day) return;
  if (applied(ctx.uc.addFromCatalog(m.day, m.parentId, id))) { view.modal = null; rerender(); }
}
export const actions = {
  catalogNewExercise: ({ scope }) => beginEdit(null, scope || 'sheet'),
  catalogEditExercise: ({ id, group }) => beginEdit(id, 'sheet', group),
  catalogPick: ({ id }) => pick(id),
  catalogUseSimilar: async ({ id }) => {
    const m = view.modal; if (!await discardForm(m)) return;
    if (findItem(data(), id)?.archived) return alert('Сначала восстановите упражнение из архива.');
    if (m.day) pick(id); else beginEdit(id);
  },
  catalogNewGroup: () => {
    if (view.modal?.type !== 'catalog') openCatalog();
    Object.assign(view.modal, { editing: { kind: 'group' }, form: { name: '' }, dirty: false }); ctx.render();
  },
  catalogCancelEdit: async () => { const m = view.modal; if (await discardForm(m)) { Object.assign(m, { editing: null, form: null, dirty: false }); ctx.render(); document.querySelector('.catalog-content')?.scrollTo(0, m.listScroll || 0); } },
};
export const listeners = [
  ['input', ev => {
    if (!ev.target.closest('#catalogForm') || view.modal?.type !== 'catalog') return;
    const m = view.modal; m.form[ev.target.name] = ev.target.value; m.dirty = true;
    if (ev.target.name === 'name' && m.editing.kind === 'exercise') ev.target.closest('form').querySelector('.catalog-similar').innerHTML = similarHtml(m);
  }],
  ['change', ev => { if (ev.target.closest('#catalogForm') && view.modal?.type === 'catalog') { view.modal.form[ev.target.name] = ev.target.value; view.modal.dirty = true; } }],
  ['submit', ev => {
    if (ev.target.id !== 'catalogForm') return;
    ev.preventDefault();
    const m = view.modal, input = Object.fromEntries(new FormData(ev.target));
    m.form = input;
    const result = m.editing.kind === 'group' ? ctx.uc.addGroup(input.name) : ctx.uc.saveCatalogProperties(m.editing.id, { ...input, aliases: [...new Map(input.aliases.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => [searchKey(s), s])).values()] }, m);
    if (!applied(result)) return;
    if (m.editing.kind === 'group') m.filters.group = result.value;
    else if (!m.editing.id && m.day) { view.modal = null; return rerender(); }
    Object.assign(m, { editing: null, form: null, dirty: false }); rerender(); document.querySelector('.catalog-content')?.scrollTo(0, m.listScroll || 0);
  }],
];
