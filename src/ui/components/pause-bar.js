// Pause bar: one pause between two blocks of a list (e.g. between two exercises).
// props: { pause, label, text, sec, max, long } — `max` is the scale shared by all bars of the list.
import { esc } from '../format.js';

export const pauseBar = ({ pause, label, text, sec, max, long }) =>
  `<div class="pb${long ? ' long' : ''}" data-pause="${pause}"><div class="pb-top"><span>${esc(label)}</span><b>${esc(text)}</b></div><span class="pb-track"><i style="width:${max > 0 ? Math.min(100, sec / max * 100) : 0}%"></i></span></div>`;
