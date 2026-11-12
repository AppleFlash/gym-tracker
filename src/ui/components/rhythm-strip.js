// Rhythm strip: one strip for a whole session, width = time. Ticks are sets, blocks are pauses.
// props: { segments: [{ kind: 'set'|'ok'|'long'|'tail', sec, pause? }], labels: [start, middle, end], legend: [[kind, text]] }
// A 'long' segment is a button (data-action="showPause" data-pause=<pause>) that scrolls to that pause and highlights it.
// Colour meaning (design-system.css): green = usual rest, amber = longer than usual, grey = a set.
import { esc } from '../format.js';

const cell = s => s.kind === 'long'
  ? `<button type="button" class="rs-long" style="flex-grow:${s.sec}" data-action="showPause" data-pause="${s.pause}" aria-label="${esc(s.label || 'Долгая пауза')}"></button>`
  : `<i class="rs-${s.kind}" style="flex-grow:${s.sec}"></i>`;

export const rhythmStrip = ({ segments, labels, legend, label = 'Ритм тренировки' }) =>
  `<div class="rs"><div class="rs-track" role="group" aria-label="${esc(label)}">${segments.map(cell).join('')}</div>
    <div class="rs-axis">${labels.map(l => `<span>${esc(l)}</span>`).join('')}</div>
    ${legend ? `<p class="rs-legend">${legend.map(([kind, text]) => `<span><i${kind === 'ok' ? '' : ` class="${kind}"`}></i>${esc(text)}</span>`).join('')}</p>` : ''}</div>`;

// Scrolls to a pause drawn by setChain / pauseBar and flashes it.
export function showPause({ pause }) {
  const el = document.querySelector(`#app [data-pause="${pause}"]:not(button)`);
  if (!el) return;
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  el.classList.remove('pause-flash'); void el.offsetWidth; el.classList.add('pause-flash');
}
export const actions = { showPause };
