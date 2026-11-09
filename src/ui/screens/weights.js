// Weight journal: catalog items by muscle group with records, search and a collapsible bar chart.
import { findGroup, groupItem, lastRecord, groupDeleteError } from '../../domain/catalog.js';
import { ctx, view, data, applied } from '../context.js';
import { esc, nice } from '../format.js';
import { openCatalog } from '../sheets/catalog.js';

export const weightsPage = () => `<div class="topline"><div><div class="subtitle">РУЧНОЙ ЖУРНАЛ</div><h1>Рабочие веса</h1></div><button class="btn primary" data-action="openCatalog">База упражнений</button></div><div class="search"><input type="search" id="wsearch" placeholder="Поиск по секциям и упражнениям" value="${esc(view.query)}" autocomplete="off" aria-label="Поиск"><button type="button" class="search-x" data-action="clearSearch" aria-label="Очистить поиск" ${view.query ? '' : 'hidden'}>✕</button></div><div id="wlist">${groupsHtml()}</div>`;

function groupsHtml() {
  const q = view.query.trim().toLowerCase(), has = s => s.toLowerCase().includes(q);
  return data().groups.map(g => {
    const items = !q || has(g.name) ? g.items : g.items.filter(i => has(i.name));
    if (q && !items.length) return '';
    return `<div class="section-head"><h2>${esc(g.name)} <span class="muted">${g.items.length}</span></h2><div class="row"><button class="btn small danger" data-action="deleteGroup" data-group="${g.id}" title="Удалить секцию">✕</button></div></div>${items.length ? items.map(i => itemCard(g, i)).join('') : '<div class="empty">Упражнений пока нет</div>'}`;
  }).join('') || (q ? '<div class="empty">Ничего не найдено</div>' : '');
}

function itemCard(g, i) {
  const r = lastRecord(i), max = Math.max(1, ...i.records.map(x => Number(x.weight) || 0)), open = view.openCharts.has(i.id), ref = `data-group="${g.id}" data-id="${i.id}"`;
  const head = `<div class="item-head" ${i.records.length ? `data-action="toggleChart" data-id="${i.id}" role="button" tabindex="0" aria-expanded="${open}"` : ''}><div><h3>${esc(i.name)}</h3><div class="subtitle">${i.records.length} записей</div></div><div class="current">${r ? nice(r.weight) + ' кг' : '—'}${r?.up ? '<span class="arrow" title="Увеличить в следующий раз">↑</span>' : ''}${i.records.length ? '<span class="chev" aria-hidden="true">›</span>' : ''}</div></div>`;
  const chart = `<div class="chart-wrap"><div><div class="chart" role="img" aria-label="График изменения рабочего веса: ${esc(i.name)}">${i.records.map((x, j) => `<div class="chart-col" title="Изменить или удалить запись" data-action="editRecord" ${ref} data-record="${x.id}"><span class="chart-weight">${nice(x.weight)}</span><div class="bar" style="height:${Math.max(7, Math.round((Number(x.weight) || 0) / max * 86))}px"></div><div class="chart-label">${x.date ? esc(x.date.slice(5)) : ('#' + (j + 1))}</div></div>`).join('')}</div></div></div>`;
  const table = `<table class="rec-table"><thead><tr><th>Дата</th><th>Вес</th><th>Повторения</th></tr></thead><tbody>${i.records.map((x, j) => `<tr data-action="editRecord" ${ref} data-record="${x.id}" role="button" tabindex="0" title="Изменить или удалить запись"><td>${x.date ? esc(x.date) : '#' + (j + 1)}</td><td>${nice(x.weight)} кг${x.up ? ' <span class="arrow">↑</span>' : ''}</td><td>${x.reps !== null && x.reps !== '' ? esc(x.reps) : '—'}</td></tr>`).join('')}</tbody></table>`;
  return `<article class="card item-card ${open ? 'open' : ''}">${head}${i.records.length ? chart + table : '<p class="note">История пока пуста.</p>'}<div class="footer-actions"><button class="btn small primary" data-action="addRecord" ${ref}>+ Запись</button><button class="btn small" data-action="editExercise" ${ref}>Изменить упражнение</button></div></article>`;
}

const redrawList = () => { document.getElementById('wlist').innerHTML = groupsHtml(); };
let searchTimer;

export const actions = {
  openCatalog: () => openCatalog(),
  toggleChart: ({ id }, el) => {
    const open = !view.openCharts.has(id);
    open ? view.openCharts.add(id) : view.openCharts.delete(id);
    el.closest('.item-card').classList.toggle('open', open);
    el.setAttribute('aria-expanded', open);
  },
  clearSearch: (_, el) => {
    const input = document.getElementById('wsearch');
    clearTimeout(searchTimer);
    view.query = input.value = '';
    el.hidden = true;
    redrawList();
    input.focus();
  },
  deleteGroup: ({ group }) => {
    const error = groupDeleteError(data(), group);
    if (error) return alert(error);
    if (confirm('Удалить секцию «' + findGroup(data(), group).name + '» и всю её историю?')) applied(ctx.uc.deleteGroup(group));
    ctx.render();
  },
  addRecord: ({ group, id }) => { view.modal = { type: 'record', group, id }; ctx.render(); },
  editRecord: ({ group, id, record }) => {
    if (!groupItem(data(), group, id)?.records.some(r => r.id === record)) return;
    view.modal = { type: 'record', group, id, recordId: record };
    ctx.render();
  },
  editExercise: ({ group, id }) => { view.modal = { type: 'catalog', group, editing: { kind: 'exercise', id }, day: null, parentId: null, notice: '' }; ctx.render(); },
};

export const listeners = [
  ['input', ev => {
    if (ev.target.id !== 'wsearch') return;
    const value = ev.target.value;
    document.querySelector('.search-x').hidden = !value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { view.query = value; redrawList(); }, 300);
  }],
];
