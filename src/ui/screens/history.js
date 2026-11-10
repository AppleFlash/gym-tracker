import { completedWorkouts, historyNewestFirst } from '../../domain/workout.js';
import { localDate } from '../../domain/shared.js';
import { view, data } from '../context.js';
import { historyChartPoints } from '../history-chart-data.js';
import { historyRow } from './result.js';

const PERIODS = [['Y', 'За весь период'], ['6M', 'За полгода'], ['3M', 'За три месяца'], ['W', 'За последнюю неделю']];

export function historyChartPage() {
  const points = historyChartPoints(data(), view.historyPeriod, localDate(new Date()));
  const empty = completedWorkouts(data()).length ? 'За этот период нет завершённых тренировок.' : 'Здесь появятся завершённые тренировки.';
  return `<div class="history-chart-content"><h1>История</h1>
    <div class="history-periods" role="radiogroup" aria-label="Период истории">${PERIODS.map(([value, label]) => `<label class="history-period"><input type="radio" name="history-period" value="${value}" aria-label="${label}" ${view.historyPeriod === value ? 'checked' : ''}><span>${value}</span></label>`).join('')}</div>
    <section class="card chart-card"><h2>Объём с отягощением</h2>${points.length ? ds.trendChart(points, 'Объём с отягощением по тренировкам', { volume: true }) : `<p class="note">${empty}</p>`}</section>
    <section class="card menu-list"><button class="menu-row" data-action="tab" data-id="history-detail"><span>Подробная история</span><span aria-hidden="true">›</span></button></section>
  </div>`;
}

export function historyDetailPage() {
  const workouts = historyNewestFirst(data());
  return `<h1>Подробная история</h1>${workouts.length ? `<section class="card menu-list">${workouts.map(historyRow).join('')}</section>` : '<div class="empty">Здесь появятся завершённые тренировки.</div>'}`;
}

export const listeners = [['change', ev => {
  if (!ev.target.matches('#app .history-periods input[name="history-period"]')) return;
  view.historyPeriod = ev.target.value;
  // Swap only the chart so the segmented control keeps its DOM and the selection slides.
  const next = document.createElement('div');
  next.innerHTML = historyChartPage();
  document.querySelector('#app .history-chart-content .chart-card')?.replaceWith(next.querySelector('.chart-card'));
}]];
