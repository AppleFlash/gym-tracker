// Reorderable list of names. Drag the grip on the right (touch and mouse, no long press) or focus it and press
// the up/down arrows. The list never reorders data itself: it fires `sortchange` {list, id, from, to} on document
// after the drop and the owner re-renders. items: [{ id, label }]; pick: optional data-action for tapping a name.
// ponytail: no auto-scroll while dragging, fine for a dozen rows; add it if a list can outgrow the sheet.
import { esc } from '../format.js';

const grip = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 12h16M4 16h16"/></svg>';

export const sortableList = ({ id, items, pick }) => `<div class="sl" data-list="${esc(id)}">${items.map(it =>
  `<div class="sl-row" data-id="${esc(it.id)}"><button type="button" class="sl-name"${pick ? ` data-action="${pick}" data-id="${esc(it.id)}"` : ' disabled'}>${esc(it.label)}</button><button type="button" class="sl-handle" data-id="${esc(it.id)}" aria-label="Переместить: ${esc(it.label)}. Стрелки вверх и вниз меняют порядок.">${grip}</button></div>`).join('')}</div>`;

const fire = (list, id, from, to) => document.dispatchEvent(new CustomEvent('sortchange', { detail: { list: list.dataset.list, id, from, to } }));
let drag = null;

const end = ev => {
  if (!drag || ev.pointerId !== drag.id) return;
  const { row, rows, list, i, j, rects } = drag; drag = null;
  const reset = () => { rows.forEach(r => { r.style.transform = ''; }); row.classList.remove('lifting', 'settling'); };
  if (ev.type === 'pointercancel') return reset();
  row.classList.replace('lifting', 'settling');
  row.style.transform = `translateY(${j > i ? rects[j].bottom - rects[i].bottom : j < i ? rects[j].top - rects[i].top : 0}px)`;
  setTimeout(() => { reset(); if (j !== i) fire(list, row.dataset.id, i, j); }, 200);
};

export const listeners = [
  ['pointerdown', ev => {
    const handle = ev.target.closest('.sl-handle');
    if (!handle || ev.button || drag) return;
    ev.preventDefault();
    const row = handle.closest('.sl-row'), list = row.parentNode, rows = [...list.children], i = rows.indexOf(row);
    drag = { row, rows, list, i, j: i, y0: ev.clientY, id: ev.pointerId, rects: rows.map(r => r.getBoundingClientRect()) };
    handle.setPointerCapture(ev.pointerId);
    row.classList.add('lifting');
    navigator.vibrate?.(10);
  }],
  ['pointermove', ev => {
    if (!drag || ev.pointerId !== drag.id) return;
    const { row, rows, i, rects } = drag, h = rects[i].height;
    const dy = Math.max(rects[0].top - rects[i].top, Math.min(rects.at(-1).bottom - rects[i].bottom, ev.clientY - drag.y0));
    row.style.transform = `translateY(${dy}px)`;
    // A row is passed when the dragged edge crosses its middle; edges (not the centre) so tall rows reach the first and last slot.
    const top = rects[i].top + dy, bottom = rects[i].bottom + dy;
    let j = i;
    rects.forEach((r, k) => { const mid = r.top + r.height / 2; if (k > i && bottom > mid) j++; if (k < i && top < mid) j--; });
    drag.j = j;
    rows.forEach((r, k) => { if (k !== i) r.style.transform = k > i && k <= j ? `translateY(${-h}px)` : k < i && k >= j ? `translateY(${h}px)` : ''; });
  }],
  ['pointerup', end],
  ['pointercancel', end],
  ['keydown', ev => {
    const handle = ev.target.closest?.('.sl-handle');
    if (!handle || !['ArrowUp', 'ArrowDown'].includes(ev.key)) return;
    ev.preventDefault();
    const list = handle.closest('.sl'), rows = [...list.children], i = rows.indexOf(handle.closest('.sl-row')), j = i + (ev.key === 'ArrowUp' ? -1 : 1);
    if (j < 0 || j >= rows.length) return;
    fire(list, handle.dataset.id, i, j);
    document.querySelector(`.sl-handle[data-id="${CSS.escape(handle.dataset.id)}"]`)?.focus({ preventScroll: true }); // the owner re-rendered
  }],
];
