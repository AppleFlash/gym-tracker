// Drag to reorder exercises of a day: long press on touch, drag handle with a mouse.
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

function endDrag() {
  if (!drag) return;
  const { row, i, j, rects } = drag, day = row.dataset.day;
  const dy = j > i ? rects[j].bottom - rects[i].bottom : j < i ? rects[j].top - rects[i].top : 0;
  // Swallow the click that ends the drag so it does not open the exercise.
  const eat = e => { e.preventDefault(); e.stopPropagation(); };
  drag = null;
  row.style.transition = 'transform .18s';
  row.style.transform = `translateY(${dy}px)`;
  addEventListener('click', eat, true);
  setTimeout(() => {
    removeEventListener('click', eat, true);
    if (j !== i) applied(ctx.uc.moveExercise(day, i, j));
    ctx.render();
  }, 180);
}

export const listeners = [
  ['pointerdown', ev => {
    const row = ev.target.closest('.ex[data-id]');
    if (!row || drag || ev.button || ev.target.closest('.alternatives-panel,.alternative-toggle,.check')) return;
    if (ev.pointerType === 'mouse') {
      if (ev.target.closest('.drag-handle')) { ev.preventDefault(); startDrag(row, ev.clientY); }
      return;
    }
    const x = ev.clientX, y = ev.clientY, events = ['pointermove', 'pointerup', 'pointercancel'];
    const off = () => events.forEach(n => removeEventListener(n, cancel));
    const cancel = e => { if (e.type !== 'pointermove' || Math.hypot(e.clientX - x, e.clientY - y) > 8) { clearTimeout(timer); off(); } };
    const timer = setTimeout(() => { off(); startDrag(row, y); }, 350);
    events.forEach(n => addEventListener(n, cancel));
  }],
  ['pointermove', ev => {
    if (!drag) return;
    const { row, list, i, rects } = drag, dy = ev.clientY - drag.y0, center = rects[i].top + rects[i].height / 2 + dy, h = rects[i].height;
    let j = i;
    row.style.transform = `translateY(${dy}px) scale(1.02)`;
    rects.forEach((r, k) => { const mid = r.top + r.height / 2; if (k > i && mid < center) j++; if (k < i && mid > center) j--; });
    drag.j = j;
    list.forEach((r, k) => { if (k !== i) r.style.transform = k > i && k <= j ? `translateY(${-h}px)` : k < i && k >= j ? `translateY(${h}px)` : ''; });
  }],
  ['pointerup', endDrag],
  ['pointercancel', endDrag],
  ['touchmove', ev => { if (drag) ev.preventDefault(); }, { passive: false }],
  ['contextmenu', ev => { if (drag || ev.target.closest('.ex[data-id]')) ev.preventDefault(); }],
];
