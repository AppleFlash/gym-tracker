// Exercise card with two states.
//   active: title, "instead of", last time, entry form (props.entry) and the list of sets.
//   done:   the same header with a chevron next to the menu; the sets are folded under it.
// A skipped exercise looks like a done one without the chevron. Tapping the header opens the exercise.
// props: { id, state: 'active'|'done'|'skipped', title, replaced, previous, lifted (omit: no line), open, menu, expanded, flat, entry, sets }
//   open/menu: data-attributes string of the action (no `open`: the header is plain text); flat: sets of a done card always shown, no fold;
//   sets: [{ attrs, number, text, note }]
import { esc, chevron, moreIcon } from '../format.js';

const down = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

const setRows = (sets, empty) => `<div class="xc-sets">${sets.map(s => `<button type="button" class="xc-set" data-action="editSet" ${s.attrs}><span class="xc-set-n">${s.number}</span><span class="xc-set-v">${s.text}${s.note ? `<small>${esc(s.note)}</small>` : ''}</span>${chevron}</button>`).join('') || `<p class="xc-empty">${empty}</p>`}</div>`;

export function exerciseCard({ id, state, title, replaced, previous, lifted, open, menu, expanded, flat, entry, sets }) {
  const done = state === 'done', foldable = done && !flat;
  return `<article class="xc is-${state}${done && (flat || expanded) ? ' is-open' : ''}" data-card="${esc(id)}">
    <div class="xc-head"><${open ? `button type="button" class="xc-open" data-action="openWorkoutExercise" ${open}` : 'div class="xc-open"'}><span class="xc-title">${esc(title)}</span>${replaced ? `<span class="xc-line">Вместо: ${esc(replaced)}</span>` : ''}${state === 'skipped' ? '<span class="xc-line">Пропущено</span>' : `<span class="xc-line">В прошлый раз: ${previous}</span>${lifted == null ? '' : `<span class="xc-line">Объём с отягощением: ${lifted}</span>`}`}</${open ? 'button' : 'div'}>
      <div class="xc-tools">${foldable ? `<button type="button" class="xc-icon xc-fold" data-action="toggleCard" data-id="${esc(id)}" aria-expanded="${!!expanded}" aria-label="Подходы: ${esc(title)}">${down}</button>` : ''}<button type="button" class="xc-icon" ${menu} aria-label="Действия с упражнением: ${esc(title)}" aria-haspopup="dialog">${moreIcon}</button></div></div>
    ${state === 'active' ? entry + (sets.length ? setRows(sets) : '') : done ? `<div class="xc-more"><div class="xc-more-inner">${setRows(sets, 'Подходы не записаны.')}</div></div>` : ''}
  </article>`;
}

// Folding is a plain class flip (no re-render), so the CSS transition plays. The state survives re-renders in `open`.
export const open = new Set();
export const actions = {
  toggleCard: ({ id }, el) => {
    const card = el.closest('.xc'), on = card.classList.toggle('is-open');
    el.setAttribute('aria-expanded', on);
    if (on) open.add(id); else open.delete(id);
  },
};
