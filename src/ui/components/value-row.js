// Value row: a list row with a title, a quiet hint under it and a big number on the right. Goes inside `.card.list`.
// props: { title, hint, value }
import { esc } from '../format.js';

export const valueRow = ({ title, hint = '', value }) =>
  `<div class="list-row vr"><div><span>${esc(title)}</span>${hint ? `<small>${esc(hint)}</small>` : ''}</div><span class="num">${esc(value)}</span></div>`;
