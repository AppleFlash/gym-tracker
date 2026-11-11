// Segmented control: radio group with a sliding thumb (pure CSS, see design-system.css).
// props: { name, label, items: [[value, text, ariaLabel?]], value, cls? }
// The screen listens to `change` on input[name] and swaps only the content below, so the DOM stays and the thumb slides.
import { esc } from '../format.js';

export const segmented = ({ name, label, items, value, cls = '' }) =>
  `<div class="segmented ${cls}" style="--n:${items.length}" role="radiogroup" aria-label="${esc(label)}">${items.map(([v, text, aria]) =>
    `<label class="segmented-item"><input type="radio" name="${esc(name)}" value="${esc(v)}" ${aria ? `aria-label="${esc(aria)}"` : ''} ${v === value ? 'checked' : ''}><span>${esc(text)}</span></label>`).join('')}</div>`;
