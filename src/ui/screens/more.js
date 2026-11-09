// "More" tab: workout history and JSON backup.
import { historyNewestFirst } from '../../domain/history.js';
import { ctx, view, data, applied } from '../context.js';
import { esc, nice, dayTitle, timeLabel, longDate } from '../format.js';

export const morePage = () => `<div class="topline"><h1>Ещё</h1></div><section class="card menu-list" aria-label="Дополнительные разделы"><button class="menu-row" data-action="tab" data-id="data"><span>Данные</span><span aria-hidden="true">›</span></button><button class="menu-row" data-action="tab" data-id="history"><span>История тренировок</span><span aria-hidden="true">›</span></button></section>`;

export const dataPage = () => `<div class="topline"><h1>Данные</h1></div><section class="card"><h2>Резервная копия</h2><p class="note">Тренировки, история и рабочие веса хранятся на этом устройстве. Экспортируйте JSON для резервной копии или переноса данных. Импорт заменяет текущие данные содержимым файла.</p><div class="footer-actions"><button class="btn" data-action="export">Экспорт JSON</button><button class="btn" data-action="import">Импорт JSON</button></div></section>`;

const performedSets = exercise => (exercise.performed?.length ? exercise.performed : [exercise]).map(e =>
  `<h3>${esc(e.name)}</h3>${e.id !== exercise.id ? `<p class="note">Вместо: ${esc(exercise.name)}</p>` : ''}${e.sets?.length ? `<p class="note">${timeLabel(e.startedAt)} — ${timeLabel(e.completedAt)}</p><ol class="saved-sets">${e.sets.map(set => `<li>${nice(set.weight)} кг × ${esc(set.reps)}</li>`).join('')}</ol>` : '<p class="note">Отмечено выполненным</p>'}`).join('');

function historyCard(h) {
  const unfinished = h.exercises.filter(e => !e.completed), completed = h.exercises.length - unfinished.length, percent = Math.round(completed / h.exercises.length * 100);
  const withSets = h.exercises.filter(e => e.sets?.length || e.performed?.length);
  return `<article class="card history-card"><div class="row"><div><h2>${dayTitle(h.day)}</h2><div class="subtitle"><time datetime="${esc(h.completedAt)}">${esc(timeLabel(h.completedAt))}</time> · ${completed} из ${h.exercises.length} упражнений</div></div><div class="percent">${percent}%</div></div><div class="progress" role="progressbar" aria-label="Завершённость тренировки" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${percent}%"></div></div>${unfinished.length ? `<h3>Не завершены</h3><ul class="history-list">${unfinished.map(e => `<li>${esc(e.name)}</li>`).join('')}</ul>` : '<p class="note">Все упражнения выполнены</p>'}${withSets.length ? `<details class="session-history"><summary>Выполненные упражнения и подходы</summary>${withSets.map(performedSets).join('')}</details>` : ''}</article>`;
}

export function historyPage() {
  const entries = historyNewestFirst(data());
  if (!entries.length) return '<div class="topline"><h1>История тренировок</h1></div><div class="empty">Здесь появятся завершённые тренировки. Нажмите «Завершить» на странице тренировки, чтобы сохранить результат.</div>';
  let date = '';
  return '<div class="topline"><h1>История тренировок</h1></div>' + entries.map(h => {
    const heading = h.date !== date ? `<h2 class="history-date">${esc(longDate(h.date))}</h2>` : '';
    date = h.date;
    return heading + historyCard(h);
  }).join('');
}

function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const actions = {
  export: () => download(ctx.uc.exportBackup(), 'gym-backup-' + new Date().toISOString().slice(0, 10) + '.json'),
  import: () => document.getElementById('importFile').click(),
};

export const listeners = [
  ['change', async ev => {
    if (ev.target.id !== 'importFile') return;
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const backup = ctx.uc.readBackup(await file.text());
      if (confirm('Заменить текущие данные импортированной копией?') && applied(ctx.uc.replaceData(backup))) {
        view.exerciseId = null;
        view.modal = null;
        ctx.render();
      }
    } catch (e) { alert('Импорт не удался: ' + e.message); }
    ev.target.value = '';
  }],
];
