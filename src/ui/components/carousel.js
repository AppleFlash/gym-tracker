// Horizontal carousel: arrows, a position label and a swipe handled here (not by native scrolling), so a short
// swipe or flick always turns the page with the same animated glide. Neighbours peek into the page gutter.
// The screen is re-rendered on every change, so the position lives here and is restored after each render.
import { chevron } from '../format.js';

const list = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const state = { key: null, index: 0, from: null };
const track = () => document.querySelector('.car-track');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const left = (el, i) => el.children[i].offsetLeft - parseFloat(getComputedStyle(el).paddingLeft);

// key identifies the content (changing it resets the position to `initial`).
export function carouselIndex(key, count, initial = 0) {
  if (state.key !== key) Object.assign(state, { key, index: initial, from: null });
  return state.index = Math.max(0, Math.min(state.index, count - 1));
}
// Moves to a slide after the next render, sliding from where the user was.
export const carouselPosition = () => state.index;
export const setCarouselPosition = index => { state.index = Math.max(0, index); };
export const advanceCarousel = index => { state.from = state.index; state.index = index; };

// listAction: data-attributes of an action that opens the full list; the position label becomes its button.
export function carousel({ slides, index, unit, listAction = '' }) {
  const n = slides.length, text = `<span class="car-position-text">${unit} ${index + 1} из ${n}</span>`, arrow = (dir, label, off) => `<button type="button" class="car-arrow${dir > 0 ? ' next' : ''}" data-action="carouselStep" data-dir="${dir}" aria-label="${label}"${off ? ' disabled' : ''}>${chevron}</button>`;
  return `<section class="car" aria-roledescription="carousel"><div class="car-nav">${arrow(-1, `Предыдущее: ${unit}`, index === 0)}${listAction ? `<button type="button" class="car-position car-list" ${listAction} aria-haspopup="dialog" aria-label="${unit} ${index + 1} из ${n}. Открыть список">${text}${list}</button>` : `<p class="car-position" aria-live="polite">${text}</p>`}${arrow(1, `Следующее: ${unit}`, index === n - 1)}</div>
    <div class="car-track" data-unit="${unit}">${slides.map((html, i) => `<div class="car-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} из ${n}">${html}</div>`).join('')}</div></section>`;
}

// Eased glide of the track to a position; a new gesture or call cancels the previous glide.
let tween = 0;
const glide = (el, target, steps = 1) => {
  cancelAnimationFrame(tween);
  const from = el.scrollLeft, dist = target - from;
  if (!dist || reduced()) { el.scrollLeft = target; return; }
  const ms = Math.min(620, 340 + 50 * (steps - 1)), t0 = performance.now();
  const frame = now => {
    const t = Math.min(1, (now - t0) / ms);
    el.scrollLeft = from + dist * (1 - (1 - t) ** 4); // ease-out: fast start, soft landing
    if (t < 1) tween = requestAnimationFrame(frame);
  };
  tween = requestAnimationFrame(frame);
};
const clamp = (el, i) => Math.max(0, Math.min(i, el.children.length - 1));
const stride = el => left(el, 1) - left(el, 0);
const nearest = el => clamp(el, Math.round(el.scrollLeft / stride(el)));
const to = i => { const el = track(); if (el) glide(el, left(el, clamp(el, i)), Math.abs(clamp(el, i) - nearest(el))); };

// Called after every render: puts the track back where the user was.
export function restoreCarousel() {
  const el = track();
  if (!el || !el.children.length) return;
  if (state.from !== null && !reduced()) {
    el.scrollLeft = left(el, clamp(el, state.from));
    requestAnimationFrame(() => glide(el, left(el, clamp(el, state.index))));
  } else el.scrollLeft = left(el, clamp(el, state.index));
  state.from = null;
}

export const actions = {
  carouselStep: ({ dir }) => to(state.index + Number(dir)),
  carouselTo: ({ index }) => to(Number(index)),
};

let frame = 0;
export const listeners = [['scroll', ev => {
  const el = ev.target;
  if (!el.classList?.contains('car-track') || frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const n = el.children.length;
    if (n < 2) return;
    const index = Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / (left(el, 1) - left(el, 0)))));
    if (index === state.index) return;
    state.index = index;
    const root = el.closest('.car');
    root.querySelector('.car-position-text').textContent = `${el.dataset.unit} ${index + 1} из ${n}`;
    root.querySelector('.car-arrow:not(.next)').disabled = index === 0;
    root.querySelector('.car-arrow.next').disabled = index === n - 1;
    el.dispatchEvent(new CustomEvent('carouselchange', { bubbles: true, detail: { index } }));
  });
}, true]];

// Swipe: follows the finger or mouse 1:1, then turns one page when the move passed ~10% of a page or was a flick.
// Vertical moves are left to the browser (touch-action: pan-y). A drag never counts as a click.
let drag = null, lastDrag = 0;
const TEXT = 'input, textarea, select, [contenteditable]';
document.addEventListener('pointerdown', ev => {
  const el = ev.target.closest?.('.car-track');
  if (!el || el.children.length < 2 || (ev.pointerType === 'mouse' && (ev.button !== 0 || ev.target.closest(TEXT)))) return;
  cancelAnimationFrame(tween);
  drag = { el, id: ev.pointerId, x: ev.clientX, y: ev.clientY, left: el.scrollLeft, start: nearest(el), moved: false, pts: [] };
});
document.addEventListener('pointermove', ev => {
  if (!drag || ev.pointerId !== drag.id) return;
  const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
  if (!drag.moved) {
    if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
    if (Math.abs(dx) < 6) return;
    drag.moved = true; drag.el.classList.add('dragging');
    try { drag.el.setPointerCapture(ev.pointerId); } catch { /* touch already captured */ }
  }
  const now = performance.now();
  drag.pts = [...drag.pts.filter(p => now - p.t < 100), { t: now, x: ev.clientX }];
  drag.dx = dx;
  drag.el.scrollLeft = drag.left - dx;
});
const release = ev => {
  if (!drag || ev.pointerId !== drag.id) return;
  const { el, moved, pts, dx, start } = drag; drag = null;
  if (!moved) return;
  lastDrag = performance.now();
  el.classList.remove('dragging');
  const [a, b] = [pts[0], pts.at(-1)], v = a && b && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0; // px/ms, negative = towards the next page
  const dir = Math.abs(v) > .2 ? -Math.sign(v) : Math.abs(dx) > stride(el) * .1 ? -Math.sign(dx) : 0;
  const target = clamp(el, start + dir);
  glide(el, left(el, target));
};
document.addEventListener('pointerup', release);
document.addEventListener('pointercancel', release);
document.addEventListener('click', ev => { if (performance.now() - lastDrag < 350) { ev.stopPropagation(); ev.preventDefault(); } }, true);
