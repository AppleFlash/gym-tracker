// Presentation helpers: escaping, ru-RU formatting and shared inline icons.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const nice = n => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
export const hasReps = r => r.reps !== null && r.reps !== undefined && r.reps !== '';
export const displayRecord = r => r ? `${nice(r.weight)} кг${r.reps !== null && r.reps !== '' ? ' × ' + esc(r.reps) : ''}` : 'Нет записей';
export const timeLabel = value => value ? new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
export const shortDate = (date, i) => date ? new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') : '#' + (i + 1);
export const longDate = date => new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
export const dayTitle = day => day === 'star' ? 'Выходной · руки' : 'День ' + day;
export const markdown = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^[*-] /gm, '• ').replace(/\n/g, '<br>');

export const chevron = '<svg viewBox="0 0 12 20" aria-hidden="true"><path d="M10 2 2 10l8 8"/></svg>';
export const plusIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
export const ring = (pct, label) => `<svg class="ring" viewBox="0 0 48 48" aria-hidden="true"><circle class="ring-track" cx="24" cy="24" r="20"/><circle class="ring-fill" cx="24" cy="24" r="20" pathLength="100" stroke-dasharray="${pct} 100"/><text x="24" y="24" dy=".35em" text-anchor="middle">${label}</text></svg>`;
