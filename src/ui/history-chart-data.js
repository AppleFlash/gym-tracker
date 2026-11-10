import { completedWorkouts, workoutSummary } from '../domain/workout.js';
import { localDate } from '../domain/shared.js';
import { shortDate } from './format.js';

export function historyChartPoints(data, period, today) {
  const start = new Date(today + 'T12:00:00');
  if (period === 'W') start.setDate(start.getDate() - 6);
  if (period === '3M' || period === '6M') {
    const day = start.getDate();
    start.setDate(1);
    start.setMonth(start.getMonth() - (period === '3M' ? 3 : 6));
    start.setDate(Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
  }
  const lower = period === 'Y' ? '' : localDate(start);
  return completedWorkouts(data)
    // Old-format workouts have no recorded sets: no data is not 0 kg, so they stay off the chart.
    .filter(w => w.date >= lower && w.date <= today && workoutSummary(w).setCount > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id))
    .map(w => ({ id: w.id, date: w.date, label: shortDate(w.date), weight: workoutSummary(w).volume }));
}
