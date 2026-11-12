// Set chain card: one exercise, its sets in a row, the rest written on the line between the two sets it belongs to.
// props: { title, meta (html, optional), sets: [{ label, rest?: { pause, text, sec, long } }] }
// `rest` of a set is the rest BEFORE it. The line grows with `sec`; a long rest is amber and bold.
import { esc } from '../format.js';

const edge = r => `<span class="sc-edge${r.long ? ' long' : ''}" data-pause="${r.pause}" style="flex-grow:${r.sec}"><b>${esc(r.text)}</b><i></i></span>`;

export const setChain = ({ title, meta = '', sets }) =>
  `<section class="card list"><div class="sc-head"><strong>${esc(title)}</strong><span>${meta}</span></div>
    <div class="sc-chain">${sets.map(s => (s.rest ? edge(s.rest) : '') + `<span class="sc-chip">${esc(s.label)}</span>`).join('')}</div></section>`;
