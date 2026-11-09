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
// Activity ring in the Fitness style: gradient stroke, round cap. size: 'sm' (rows) or 'lg' (hero).
export const ring = (pct, label, size = 'sm') => `<svg class="ring ring-${size}" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--ring-a)"/><stop offset="1" style="stop-color:var(--ring-b)"/></linearGradient></defs><circle class="ring-track" cx="24" cy="24" r="20"/><circle class="ring-fill" cx="24" cy="24" r="20" pathLength="100" stroke-dasharray="${pct} 100"/><text x="24" y="24" dy=".35em" text-anchor="middle">${label}</text></svg>`;

// Weight records as chart points for ds.chartCard.
export const chartPoints = records => records.map((r, i) => ({ v: Number(r.weight) || 0, t: r.date ? Date.parse(r.date + 'T12:00:00') || null : null, label: shortDate(r.date, i), sub: shortDate(r.date, i) + (hasReps(r) ? ' · ' + r.reps + ' повт.' : '') }));

// Chip with the change since the previous record; a new maximum reads as a record.
export function trendChip(trend) {
  if (!trend || (!trend.delta && !trend.record)) return '';
  if (trend.record) return `<span class="trend pr">Рекорд</span>`;
  return `<span class="trend ${trend.delta > 0 ? 'up' : 'down'}">${trend.delta > 0 ? '+' : '−'}${nice(Math.abs(trend.delta))} кг</span>`;
}
