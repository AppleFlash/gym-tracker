// Segment progress: one animated bar per step, an optional caption above. Always sticks under the navigation bar.
// segments: [{ id, state: 'done'|'skipped'|'pending', label }]; `current` marks the step shown in the carousel.
// Tapping a segment sends data-action="carouselTo". The fill animates through ds.playToggles (class .checked).
import { esc } from '../format.js';

export function segmentProgress({ caption, segments, current }) {
  return `<div class="sp" role="group" aria-label="Прогресс тренировки">${caption ? `<p class="sp-caption">${esc(caption)}</p>` : ''}<div class="sp-track">${segments.map((s, i) =>
    `<button type="button" class="sp-cell${s.state === 'done' ? ' checked' : ''}${s.state === 'skipped' ? ' is-skipped' : ''}${i === current ? ' is-current' : ''}" data-action="carouselTo" data-index="${i}" data-id="${esc(s.id)}"${i === current ? ' aria-current="step"' : ''} aria-label="${esc(s.label)}"><span class="sp-bar"></span></button>`).join('')}</div></div>`;
}

// The carousel reports every position change, so the marker follows swipes without a re-render.
export const listeners = [['carouselchange', ev => {
  document.querySelectorAll('.sp-cell').forEach((cell, i) => {
    cell.classList.toggle('is-current', i === ev.detail.index);
    if (i === ev.detail.index) cell.setAttribute('aria-current', 'step'); else cell.removeAttribute('aria-current');
  });
}]];
