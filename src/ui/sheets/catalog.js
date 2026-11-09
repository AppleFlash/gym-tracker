// Exercise catalog sheet: muscle groups → exercises. Picks an exercise for a day or as an alternative,
// creates groups and exercises, renames exercises. State: view.modal = {type: 'catalog', day, parentId, group, editing, notice}.
import { findGroup, findItem } from '../../domain/catalog.js';
import { isInProgram } from '../../domain/program.js';
import { ctx, view, data, applied } from '../context.js';
import { esc, chevron } from '../format.js';

const isCatalog = () => view.modal?.type === 'catalog';

export function openCatalog(day = null, parentId = null) {
  view.modal = { type: 'catalog', day, parentId, group: null, editing: null, notice: '' };
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

function exerciseList(m, group, context) {
  const rows = group.items.map(item => {
    const added = alreadyAdded(m, item), id = esc(item.id);
    return `<div class="catalog-exercise-row"><button class="catalog-row" data-action="${m.day ? 'catalogPick' : 'catalogEditExercise'}" data-id="${id}" ${added ? 'disabled' : ''}><span>${esc(item.name)}${added ? '<small>Уже добавлено</small>' : ''}</span><span class="row-chevron" aria-hidden="true">${m.day ? '+' : '›'}</span></button>${m.day ? `<button class="btn small" data-action="catalogEditExercise" data-id="${id}" aria-label="Изменить название: ${esc(item.name)}">Изм.</button>` : ''}</div>`;
  }).join('');
  return `<p class="lede">${context}</p><div class="topline"><h2>Упражнения</h2><button class="btn small primary" data-action="catalogNewExercise">+ Упражнение</button></div>${m.notice ? `<p class="note" role="status">${esc(m.notice)}</p>` : ''}<section class="card catalog-list" aria-label="Упражнения группы">${rows || '<p class="note catalog-empty">В этой группе пока нет упражнений. Добавьте первое в базу.</p>'}</section>`;
}

const groupList = context => `<p class="lede">${context}</p><section class="card catalog-list" aria-label="Группы мышц">${data().groups.map(g => `<button class="catalog-row" data-action="catalogGroup" data-id="${esc(g.id)}"><span><strong>${esc(g.name)}</strong><small>${g.items.length} упражнений</small></span><span class="row-chevron" aria-hidden="true">›</span></button>`).join('')}</section><button class="btn" data-action="catalogNewGroup">+ Группа мышц</button>`;

export function catalogHtml() {
  const m = view.modal, group = findGroup(data(), m.group);
  const context = m.day ? (m.parentId ? 'Выбор аналогичного упражнения' : 'Добавление в тренировку') : 'Группы мышц и упражнения';
  const content = m.editing ? editForm(m, group) : group ? exerciseList(m, group, context) : groupList(context);
  const back = group || m.editing ? `<button class="nav-back" data-action="catalogBack" aria-label="${m.editing ? 'Назад' : 'К группам мышц'}">${chevron}<span>${m.editing ? 'Назад' : 'Группы'}</span></button>` : '';
  return `<dialog class="modal catalog-modal" aria-labelledby="catalogTitle"><section class="card catalog-shell"><div class="sheet-nav catalog-header"><div class="nav-side">${back}</div><h2 class="sheet-title" id="catalogTitle">${esc(group ? group.name : 'База упражнений')}</h2><div class="nav-side end"><button class="nav-action" data-action="close" aria-label="Закрыть базу упражнений">Закрыть</button></div></div><div class="catalog-content">${content}</div></section></dialog>`;
}

function pick(itemId) {
  const m = view.modal;
  if (!m.day || m.editing) return;
  const result = ctx.uc.addFromCatalog(m.day, m.parentId, itemId);
  if (!applied(result)) return;
  if (result.value.alternativeOf) view.expanded.add(m.day + ':' + result.value.alternativeOf);
  view.modal = null;
  ctx.render();
  document.querySelector(`.ex[data-id="${CSS.escape(result.value.rowId)}"]`)?.scrollIntoView({ block: 'nearest' });
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
  catalogEditExercise: andRender((m, { id }) => { m.editing = { kind: 'exercise', id }; }),
  catalogCancelEdit: andRender(m => { m.editing = null; }),
  catalogPick: inCatalog((m, { id }) => { if (findItem(data(), id)) pick(id); }),
};

export const listeners = [
  ['submit', ev => {
    if (ev.target.id !== 'catalogForm') return;
    ev.preventDefault();
    if (isCatalog() && view.modal.editing) save(ev.target);
  }],
];
