// Hold and drag an exercise on touch or with a mouse; Alt + arrows works from its title.
import { ctx, applied } from './context.js';

let drag = null;

function startDrag(row, y) {
  const list = [...row.parentNode.querySelectorAll('.ex[data-id]')], i = list.indexOf(row);
  drag = { row, list, i, j: i, y0: y, rects: list.map(r => r.getBoundingClientRect()) };
  row.classList.add('dragging');
  row.style.transform = 'scale(1.02)';
  list.forEach(r => { if (r !== row) r.style.transition = 'transform .2s'; });
  navigator.vibrate?.(10);
}

function endDrag(ev) {
  if (!drag) return;
  if (ev?.type === 'pointercancel') { drag = null; ctx.render(); return; }
  const { row, i, j, rects, list: dragList } = drag, day = row.dataset.day;
  const dy = j > i ? rects[j].bottom - rects[i].bottom : j < i ? rects[j].top - rects[i].top : 0;
  // Swallow the click that ends the drag so it does not open the exercise.
  const eat = e => { e.preventDefault(); e.stopPropagation(); };
  drag = null;
  row.style.transition = 'transform .18s';
  row.style.transform = `translateY(${dy}px)`;
  addEventListener('click', eat, true);
  setTimeout(() => {
    removeEventListener('click', eat, true);
    // Cards may differ from the template (slots of a workout), so move by ids within the program.
    const ids = (ctx.store.state.days[day] || []).map(e => e.id), from = ids.indexOf(row.dataset.id), to = ids.indexOf(dragList[j]?.dataset.id);
    if (j !== i && from >= 0 && to >= 0) applied(ctx.uc.moveExercise(day, from, to));
    ctx.render();
  }, 180);
}

export const listeners = [
  ['pointerdown', ev => {
    const row = ev.target.closest('.ex[data-id]');
    if (!row || drag || ev.button || ev.target.closest('.wk-actions,.wk-more,.set-entry,.set-chips,input,textarea')) return;
    if (ev.pointerType === 'mouse' && ev.target.closest('.drag-handle')) {
      ev.preventDefault(); startDrag(row, ev.clientY); return;
    }
    const x = ev.clientX, y = ev.clientY, events = ['pointermove', 'pointerup', 'pointercancel'];
    const off = () => events.forEach(n => removeEventListener(n, cancel));
    const cancel = e => { if (e.type !== 'pointermove' || Math.hypot(e.clientX - x, e.clientY - y) > 8) { clearTimeout(timer); off(); } };
    const timer = setTimeout(() => { off(); startDrag(row, y); }, 350);
    events.forEach(n => addEventListener(n, cancel));
  }],
  ['pointermove', ev => {
    if (!drag) return;
    const { row, list, i, rects } = drag, dy = ev.clientY - drag.y0, center = rects[i].top + rects[i].height / 2 + dy;
    const gap = i + 1 < rects.length ? rects[i + 1].top - rects[i].bottom : i > 0 ? rects[i].top - rects[i - 1].bottom : 0;
    const h = rects[i].height + gap;
    let j = i;
    row.style.transform = `translateY(${dy}px) scale(1.02)`;
    rects.forEach((r, k) => { const mid = r.top + r.height / 2; if (k > i && mid < center) j++; if (k < i && mid > center) j--; });
    drag.j = j;
    list.forEach((r, k) => { if (k !== i) r.style.transform = k > i && k <= j ? `translateY(${-h}px)` : k < i && k >= j ? `translateY(${h}px)` : ''; });
  }],
  ['keydown', ev => {
    if (!ev.altKey || !['ArrowUp', 'ArrowDown'].includes(ev.key) || !ev.target.matches('.exercise-link')) return;
    const row = ev.target.closest('.ex[data-id]');
    if (!row) return;
    ev.preventDefault();
    const order = ctx.store.state.days[row.dataset.day] || [], from = order.findIndex(e => e.id === row.dataset.id);
    const to = from + (ev.key === 'ArrowUp' ? -1 : 1);
    if (from < 0 || to < 0 || to >= order.length) return;
    if (applied(ctx.uc.moveExercise(row.dataset.day, from, to))) {
      ctx.render();
      [...document.querySelectorAll('#app .ex[data-id]')].find(e => e.dataset.id === row.dataset.id)?.querySelector('.exercise-link')?.focus({ preventScroll: true });
    }
  }],
  ['pointerup', endDrag],
  ['pointercancel', endDrag],
  ['touchmove', ev => { if (drag) ev.preventDefault(); }, { passive: false }],
  ['contextmenu', ev => { if (drag || ev.target.closest('.ex[data-id]')) ev.preventDefault(); }],
];
