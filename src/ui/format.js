// Presentation helpers: escaping, ru-RU formatting and shared inline icons.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const nice = n => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
export const hasReps = r => r.reps !== null && r.reps !== undefined && r.reps !== '';
export const timeLabel = value => value ? new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
export const shortDate = date => new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
export const longDate = date => new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
export const dayLetter = day => day === 'star' ? '★' : day;
export const dayTitle = day => day === 'star' ? 'Выходной · руки' : 'Тренировка ' + day;
export const markdown = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^[*-] /gm, '• ').replace(/\n/g, '<br>');

// "60 кг × 10"; a set list reads "60×10 · 60×9".
export const setText = s => s ? `${nice(s.weight)} кг × ${s.reps}` : '';
export const setsText = sets => sets.map(s => `${nice(s.weight)}×${s.reps}`).join(' · ');
export const kg = n => nice(Math.round(n * 100) / 100) + ' кг';

// Russian plural: plural(5, ['упражнение', 'упражнения', 'упражнений']) → "5 упражнений".
export const plural = (n, [one, few, many]) => {
  const m10 = n % 10, m100 = n % 100;
  return `${n} ${m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many}`;
};
export const EXERCISES = ['упражнение', 'упражнения', 'упражнений'];
export const SETS = ['подход', 'подхода', 'подходов'];

export const chevron = '<svg viewBox="0 0 12 20" aria-hidden="true"><path d="M10 2 2 10l8 8"/></svg>';
export const plusIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
export const moreIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></g></svg>';
export const infoIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
export const trashIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
export const helpButton = (action, label) => `<button type="button" class="help-btn" data-action="${action}" aria-label="${label}">?</button>`;

// Activity ring in the Fitness style: gradient stroke, round cap. size: 'sm' (rows) or 'md' (cards).
export const ring = (pct, label, size = 'sm') => `<svg class="ring ring-${size}" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--ring-a)"/><stop offset="1" style="stop-color:var(--ring-b)"/></linearGradient></defs><circle class="ring-track" cx="24" cy="24" r="20"/><circle class="ring-fill" cx="24" cy="24" r="20" pathLength="100" stroke-dasharray="${pct} 100"/><text x="24" y="24" dy=".35em" text-anchor="middle">${label}</text></svg>`;

