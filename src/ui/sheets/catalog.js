// Exercise catalog sheet: search or muscle groups → exercises. Picks an exercise for a day or as an alternative,
// creates groups and exercises, renames exercises. State: view.modal = {type: 'catalog', day, parentId, group, editing, notice, query}.
import { findGroup, findItem } from '../../domain/catalog.js';
import { isInProgram } from '../../domain/program.js';
import { ctx, view, data, applied } from '../context.js';
import { esc, chevron } from '../format.js';

const isCatalog = () => view.modal?.type === 'catalog';

export function openCatalog(day = null, parentId = null) {
  view.modal = { type: 'catalog', day, parentId, group: null, editing: null, notice: '', query: '' };
  ctx.render();
}

// Push depth inside the sheet: groups → exercises → edit form.
export const catalogDepth = m => m.editing ? 2 : m.group ? 1 : 0;

const alreadyAdded = (m, item) => !!m.day && isInProgram(data(), m.day, m.parentId, item.id);

function editForm(m, group) {
  const item = group?.items.find(i => i.id === m.editing.id);
  const title = m.editing.kind === 'group' ? 'Новая группа мышц' : item ? 'Изменить название' : 'Новое упражнение';
  return `<form id="catalogForm"><h2>${title}</h2><label class="field" style="margin-top:18px">Название<input name="name" value="${esc(item?.name || '')}" required autocomplete="off"></label><div class="form-actions"><button class="btn primary" type="submit">Сохранить в базу</button><button class="btn" type="button" data-action="catalogCancelEdit">Отмена</button></div></form>`;
}

function itemRow(m, item, groupName = '') {
  const added = alreadyAdded(m, item), id = esc(item.id);
  // Renaming needs the group; search results carry it in data-group.
  const group = groupName ? ` data-group="${esc(data().groups.find(g => g.items.includes(item))?.id)}"` : '';
  return `<div class="catalog-exercise-row"><button class="catalog-row" data-action="${m.day ? 'catalogPick' : 'catalogEditExercise'}" data-id="${id}"${group} ${added ? 'disabled' : ''}><span>${esc(item.name)}${groupName ? `<small>${esc(groupName)}</small>` : ''}${added ? '<small>Уже добавлено</small>' : ''}</span><span class="row-chevron" aria-hidden="true">${m.day ? '+' : '›'}</span></button>${m.day ? `<button class="btn small" data-action="catalogEditExercise" data-id="${id}"${group} aria-label="Изменить название: ${esc(item.name)}">Изм.</button>` : ''}</div>`;
}

function exerciseList(m, group, context) {
  const rows = group.items.map(item => itemRow(m, item)).join('');
  return `<p class="lede">${context}</p><div class="topline"><h2>Упражнения</h2><button class="btn small primary" data-action="catalogNewExercise">+ Упражнение</button></div>${m.notice ? `<p class="note" role="status">${esc(m.notice)}</p>` : ''}<section class="card catalog-list" aria-label="Упражнения группы">${rows || '<p class="note catalog-empty">В этой группе пока нет упражнений. Добавьте первое в базу.</p>'}</section>`;
}

// Search by name across all groups; with an empty query the groups are listed.
function searchResults(m) {
  const q = (m.query || '').trim().toLowerCase();
  if (!q) return '';
  const found = data().groups.flatMap(g => g.items.filter(i => i.name.toLowerCase().includes(q)).map(i => itemRow(m, i, g.name))).join('');
  return `<section class="card catalog-list" aria-label="Найденные упражнения">${found || '<p class="note catalog-empty">Ничего не найдено. Создайте упражнение в нужной группе.</p>'}</section>`;
}

const groupList = (m, context) => `<p class="lede">${context}</p><div class="search"><input type="search" id="catalogSearch" placeholder="Поиск по названию" value="${esc(m.query || '')}" autocomplete="off" aria-label="Поиск упражнения"></div><div class="catalog-results">${searchResults(m)}</div><div class="catalog-groups" ${m.query?.trim() ? 'hidden' : ''}><section class="card catalog-list" aria-label="Группы мышц">${data().groups.map(g => `<button class="catalog-row" data-action="catalogGroup" data-id="${esc(g.id)}"><span><strong>${esc(g.name)}</strong><small>${g.items.length} упражнений</small></span><span class="row-chevron" aria-hidden="true">›</span></button>`).join('')}</section><button class="btn" data-action="catalogNewGroup">+ Группа мышц</button></div>`;

export function catalogHtml() {
  const m = view.modal, group = findGroup(data(), m.group);
  const context = m.day ? (m.parentId ? 'Выбор аналогичного упражнения' : 'Добавление в тренировку') : 'Группы мышц и упражнения';
  const content = m.editing ? editForm(m, group) : group ? exerciseList(m, group, context) : groupList(m, context);
  const back = group || m.editing ? `<button class="nav-back" data-action="catalogBack" aria-label="${m.editing ? 'Назад' : 'К группам мышц'}">${chevron}<span>${m.editing ? 'Назад' : 'Группы'}</span></button>` : '';
  return `<dialog class="modal catalog-modal" aria-labelledby="catalogTitle"><section class="card catalog-shell"><div class="sheet-nav catalog-header"><div class="nav-side">${back}</div><h2 class="sheet-title" id="catalogTitle">${esc(group ? group.name : 'База упражнений')}</h2><div class="nav-side end"><button class="nav-action" data-action="close" aria-label="Закрыть базу упражнений">Закрыть</button></div></div><div class="catalog-content">${content}</div></section></dialog>`;
}

function pick(itemId) {
  const m = view.modal;
  if (!m.day || m.editing) return;
  const result = ctx.uc.addFromCatalog(m.day, m.parentId, itemId);
  if (!applied(result)) return;
  view.modal = null;
  ctx.render();
  document.querySelector(`.ex[data-id="${CSS.escape(result.value.slot.id)}"]`)?.scrollIntoView({ block: 'nearest' });
}

function save(form) {
  const m = view.modal, edit = m.editing, name = new FormData(form).get('name');
  const result = edit.kind === 'group' ? ctx.uc.addGroup(name) : ctx.uc.saveCatalogItem(m.group, edit.id, name);
  if (!applied(result)) return;
  const savedId = result.value;
  if (edit.kind === 'group') m.group = savedId;
  m.editing = null;
  m.notice = edit.id ? 'Название обновлено' : edit.kind === 'group' ? 'Группа создана'
    : m.day ? 'Добавлено в базу. Выберите упражнение, чтобы добавить его в тренировку.' : 'Упражнение добавлено в базу';
  ctx.render();
  document.querySelector(`.catalog-row[data-id="${CSS.escape(savedId)}"]`)?.scrollIntoView({ block: 'nearest' });
}

// Catalog actions only act while the catalog sheet is open.
const inCatalog = change => (dataset, el) => { if (isCatalog()) { change(view.modal, dataset, el); } };
const andRender = change => inCatalog((m, dataset) => { change(m, dataset); ctx.render(); });

export const actions = {
  catalogGroup: andRender((m, { id }) => { m.group = id; m.notice = ''; }),
  catalogBack: andRender(m => { if (m.editing) m.editing = null; else m.group = null; m.notice = ''; }),
  catalogNewGroup: andRender(m => { m.editing = { kind: 'group' }; }),
  catalogNewExercise: andRender(m => { m.editing = { kind: 'exercise' }; }),
  catalogEditExercise: andRender((m, { id, group }) => { if (group) m.group = group; m.editing = { kind: 'exercise', id }; }),
  catalogCancelEdit: andRender(m => { m.editing = null; }),
  catalogPick: inCatalog((m, { id }) => { if (findItem(data(), id)) pick(id); }),
};

export const listeners = [
  ['input', ev => {
    if (ev.target.id !== 'catalogSearch' || !isCatalog()) return;
    view.modal.query = ev.target.value;
    const sheet = ev.target.closest('.catalog-content');
    sheet.querySelector('.catalog-results').innerHTML = searchResults(view.modal);
    sheet.querySelector('.catalog-groups').hidden = !!view.modal.query.trim();
  }],
  ['submit', ev => {
    if (ev.target.id !== 'catalogForm') return;
    ev.preventDefault();
    if (isCatalog() && view.modal.editing) save(ev.target);
  }],
];
