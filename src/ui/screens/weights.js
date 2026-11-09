// Weight journal: catalog items by muscle group with records, search and a collapsible bar chart.
import { findGroup, groupItem, recordTrend, groupDeleteError } from '../../domain/catalog.js';
import { ctx, view, data, applied } from '../context.js';
import { esc, nice, hasReps, shortDate, longDate, chartPoints, trendChip } from '../format.js';
import { openCatalog } from '../sheets/catalog.js';

const trashIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';

export const weightsPage = () => `<h1>Рабочие веса</h1><div class="search"><input type="search" id="wsearch" placeholder="Поиск по группам и упражнениям" value="${esc(view.query)}" autocomplete="off" aria-label="Поиск"><button type="button" class="search-x" data-action="clearSearch" aria-label="Очистить поиск" ${view.query ? '' : 'hidden'}>✕</button></div><div id="wlist">${groupsHtml()}</div>`;

function groupsHtml() {
  const q = view.query.trim().toLowerCase(), has = s => s.toLowerCase().includes(q);
  return data().groups.map(g => {
    const items = !q || has(g.name) ? g.items : g.items.filter(i => has(i.name));
    if (q && !items.length) return '';
    return `<div class="w-group-head"><h2 class="group-title">${esc(g.name)}</h2><button class="icon-btn" data-action="deleteGroup" data-group="${g.id}" aria-label="Удалить группу «${esc(g.name)}»">${trashIcon}</button></div><section class="card list w-list">${items.length ? items.map(i => itemRow(g, i)).join('') : '<p class="note w-empty">В группе пока нет упражнений.</p>'}</section>`;
  }).join('') || (q ? '<div class="empty">Ничего не найдено</div>' : '');
}

// Row: name, trend line and the latest weight. Tapping expands the chart, records and actions in place.
function itemRow(g, i) {
  const trend = recordTrend(i), open = view.openCharts.has(i.id), ref = `data-group="${g.id}" data-id="${i.id}"`, count = i.records.length;
  const meta = count ? `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'запись' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'записи' : 'записей'}${trend.last.date ? ' · ' + shortDate(trend.last.date, 0) : ''}` : 'Нет записей';
  const records = [...i.records].reverse().map(r => `<button class="list-row rec-row" data-action="editRecord" ${ref} data-record="${r.id}"><span>${r.date ? esc(longDate(r.date)) : 'Без даты'}</span><span class="num">${nice(r.weight)} кг${hasReps(r) ? ' × ' + esc(r.reps) : ''}${r.up ? ' <span class="arrow" title="Увеличить в следующий раз">↑</span>' : ''}</span></button>`).join('');
  const chart = count > 1 ? ds.chartCard('w-' + i.id, { pts: chartPoints(i.records), unit: 'кг', label: 'История рабочего веса: ' + i.name }) : '';
  return `<article class="w-item ${open ? 'open' : ''}"><div class="w-row" data-action="toggleChart" data-id="${i.id}" role="button" tabindex="0" aria-expanded="${open}"><span class="w-name"><strong>${esc(i.name)}</strong><span class="muted">${meta}</span></span>${count > 1 ? ds.sparkline(i.records.map(r => r.weight)) : ''}<span class="w-value">${trend ? `<b class="num">${nice(trend.last.weight)}<small>кг</small></b>${trendChip(trend)}` : '<b class="num muted">—</b>'}</span></div><div class="w-detail"><div class="w-detail-inner">${chart}${records ? `<div class="w-records">${records}</div>` : ''}<div class="footer-actions"><button class="btn small primary" data-action="addRecord" ${ref}>+ Запись</button><button class="btn small" data-action="editExercise" ${ref}>Переименовать</button></div></div></div></article>`;
}

const redrawList = () => { document.getElementById('wlist').innerHTML = groupsHtml(); };
let searchTimer;

export const actions = {
  openCatalog: () => openCatalog(),
  toggleChart: ({ id }, el) => {
    const open = !view.openCharts.has(id), item = el.closest('.w-item');
    open ? view.openCharts.add(id) : view.openCharts.delete(id);
    item.classList.toggle('open', open);
    el.setAttribute('aria-expanded', open);
    // Draw the line again so opening a row shows the progress, not a static picture.
    const card = item.querySelector('.chart-card');
    if (open && card) ds.setRange(card, ds.range);
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
