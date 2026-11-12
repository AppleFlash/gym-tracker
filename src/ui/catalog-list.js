import { catalogList, EQUIPMENT } from '../domain/catalog.js';
import { isInProgram, alternativeGroup } from '../domain/program.js';
import { ctx, view, data, applied, rerender } from './context.js';
import { esc, setText, shortDate, dayLetter } from './format.js';

export const emptyFilters = () => ({ query: '', mode: 'all', group: '', equipment: '' });
export const catalogState = scope => scope === 'sheet' ? view.modal.filters : (view.catalog ||= emptyFilters());
const option = (value, title, selected) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(title)}</option>`;
export const equipmentOptions = (value, all = false) => (all ? option('', 'Любое', value) + option('unknown', 'Не указано', value) : option('', 'Не указано', value)) + Object.entries(EQUIPMENT).map(([id, title]) => option(id, title, value || '')).join('');
export const groupOptions = (value, only = null) => data().groups.filter(g => !only || g.id === only).map(g => option(g.id, g.name, value)).join('');

export function catalogRows(scope) {
  const state = catalogState(scope), target = scope === 'sheet' ? view.modal : null;
  const lockedGroup = target?.parentId ? alternativeGroup(data(), target.day, target.parentId)?.id : null;
  const rows = catalogList(data(), { ...state, ...(lockedGroup ? { group: lockedGroup } : {}) });
  if (!rows.length) return `<div class="empty">${state.query || state.group || state.equipment ? 'Ничего не найдено. Сбросьте фильтры или создайте упражнение.' : state.mode === 'favorites' ? 'Добавляйте упражнения в избранное кнопкой со звездой.' : state.mode === 'archived' ? 'В архиве пока нет упражнений.' : 'Пока нет упражнений.'}</div>`;
  return `<section class="card catalog-list">${rows.map(({ item: i, group, days, last, set }) => {
    const added = target?.day && isInProgram(data(), target.day, target.parentId, i.id);
    const action = scope === 'page' ? 'openItem' : target?.day ? 'catalogPick' : 'catalogEditExercise';
    return `<div class="catalog-exercise-row"><button class="catalog-row" data-action="${action}" data-id="${esc(i.id)}" data-group="${esc(group.id)}" data-from="exercises" ${added || (target?.day && i.archived) ? 'disabled' : ''}><span><strong>${esc(i.name)}</strong><small>${esc(group.name)} · ${EQUIPMENT[i.equipment] || 'Оборудование не указано'}</small><small>${set ? `${setText(set)} · ${esc(shortDate(last.workout.date))}` : 'Ещё не выполнялось'}</small>${days.length ? `<small>В программе: ${days.map(dayLetter).join(', ')}</small>` : ''}${added ? '<small>Уже добавлено</small>' : i.archived ? '<small>В архиве</small>' : ''}</span></button><button class="icon-btn catalog-star" data-action="catalogFavorite" data-id="${esc(i.id)}" aria-pressed="${i.favorite}" aria-label="${i.favorite ? 'Убрать из избранного' : 'В избранное'}: ${esc(i.name)}"><svg viewBox="0 0 24 24" width="20" height="20" fill="${i.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg></button>${i.archived ? `<button class="btn small" data-action="catalogRestore" data-id="${esc(i.id)}">Вернуть</button>` : target?.day ? `<button class="btn small" data-action="catalogEditExercise" data-id="${esc(i.id)}" data-group="${esc(group.id)}">Изм.</button>` : ''}</div>`;
  }).join('')}</section>`;
}

export function catalogBrowser(scope) {
  const s = catalogState(scope), target = scope === 'sheet' ? view.modal : null;
  const lockedGroup = target?.parentId ? alternativeGroup(data(), target.day, target.parentId)?.id : null;
  return `<div class="catalog-browser" data-catalog-scope="${scope}"><div class="search"><input id="${scope === 'sheet' ? 'catalogSearch' : 'wsearch'}" type="search" data-cat-query placeholder="Название или синоним" value="${esc(s.query)}" aria-label="Поиск упражнения" autocomplete="off"></div>
    <div class="catalog-modes" aria-label="Показать">${[['all', 'Все'], ['favorites', 'Избранное'], ['program', 'В программе'], ['archived', 'Архивные']].map(([id, name]) => `<button class="btn small ${s.mode === id ? 'primary' : ''}" data-action="catalogMode" data-mode="${id}" data-scope="${scope}" aria-pressed="${s.mode === id}">${name}</button>`).join('')}</div>
    <div class="form-grid catalog-filters"><label class="field">Группа мышц<select data-cat-filter="group" ${lockedGroup ? 'disabled' : ''}>${lockedGroup ? groupOptions(lockedGroup, lockedGroup) : '<option value="">Все группы</option>' + groupOptions(s.group)}</select></label><label class="field">Оборудование<select data-cat-filter="equipment">${equipmentOptions(s.equipment, true)}</select></label></div>
    ${s.group || s.equipment || s.mode !== 'all' ? `<button class="btn small" data-action="catalogReset" data-scope="${scope}">Сбросить фильтры</button>` : ''}
    <div class="catalog-results">${catalogRows(scope)}</div>
    <div class="catalog-tools">${!target?.day ? '<button class="btn small" data-action="catalogNewGroup">+ Группа мышц</button>' : ''}${s.group ? `<button class="btn small" data-action="catalogDeleteGroup" data-group="${esc(s.group)}">Удалить пустую группу</button>` : ''}</div>
    <div class="catalog-dock"><button class="btn block" data-action="catalogNewExercise" data-scope="${scope}">${s.query.trim() ? `Создать «${esc(s.query.trim())}»` : '+ Упражнение'}</button></div></div>`;
}

const scopeOf = el => el.closest('[data-catalog-scope]')?.dataset.catalogScope;
export const actions = {
  catalogMode: ({ scope, mode }) => { catalogState(scope).mode = mode; rerender(); },
  catalogReset: ({ scope }) => { Object.assign(catalogState(scope), { mode: 'all', group: '', equipment: '' }); rerender(); },
  catalogFavorite: ({ id }) => { if (applied(ctx.uc.toggleFavorite(id))) rerender(); },
  catalogRestore: ({ id }) => { if (applied(ctx.uc.archiveItem(id, false))) rerender(); },
  catalogDeleteGroup: async ({ group }) => { if (await ds.confirm('Удалить пустую группу?', 'Упражнения и история не удаляются.', { ok: 'Удалить', destructive: true }) && applied(ctx.uc.deleteGroup(group))) { if (view.catalog?.group === group) view.catalog.group = ''; if (view.modal?.filters?.group === group) view.modal.filters.group = ''; rerender(); } },
};
export const listeners = [
  ['input', ev => {
    if (!ev.target.matches('[data-cat-query]')) return;
    const scope = scopeOf(ev.target); catalogState(scope).query = ev.target.value;
    const root = ev.target.closest('[data-catalog-scope]');
    root.querySelector('.catalog-results').innerHTML = catalogRows(scope);
    root.querySelector('[data-action="catalogNewExercise"]').textContent = ev.target.value.trim() ? `Создать «${ev.target.value.trim()}»` : '+ Упражнение';
  }],
  ['change', ev => { const field = ev.target.dataset.catFilter; if (field) { catalogState(scopeOf(ev.target))[field] = ev.target.value; rerender(); } }],
];
