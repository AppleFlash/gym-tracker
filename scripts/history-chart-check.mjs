import assert from 'node:assert/strict';
import { historyChartPoints } from '../src/ui/history-chart-data.js';
import { workoutSummary } from '../src/domain/workout.js';

const workout = (date, id = date, extra = {}) => ({ id, date, status: 'completed', completedAt: date + 'T12:00:00Z', slots: [{ id: 's', name: 'x', selectedId: 'v', status: 'done', variants: [{ id: 'v', name: 'x', weightId: null }], performed: { v: { sets: [{ id: 'set', weight: 10, reps: 1 }] } } }], ...extra });
const dates = (values, period, today = '2026-11-11') => historyChartPoints({ workouts: values.map(d => workout(d)) }, period, today).map(p => p.date);
assert.deepEqual(dates(['2026-11-04', '2026-11-05', '2026-11-11', '2026-11-12'], 'W'), ['2026-11-05', '2026-11-11']);
assert.deepEqual(dates(['2026-08-10', '2026-08-11', '2026-11-11', '2026-11-12'], '3M'), ['2026-08-11', '2026-11-11']);
assert.deepEqual(dates(['2026-05-10', '2026-05-11', '2026-11-11', '2026-11-12'], '6M'), ['2026-05-11', '2026-11-11']);
assert.deepEqual(dates(['2026-02-27', '2026-02-28', '2026-03-01'], '3M', '2026-05-31'), ['2026-02-28', '2026-03-01']);
assert.deepEqual(dates(['2024-02-28', '2024-02-29', '2024-03-01'], '6M', '2024-08-31'), ['2024-02-29', '2024-03-01']);
assert.deepEqual(historyChartPoints({ workouts: [workout('2026-11-10', 'old', { slots: [] })] }, 'Y', '2026-11-11'), []);
assert.deepEqual(dates(['2020-01-01', '2026-11-11', '2026-11-12'], 'Y'), ['2020-01-01', '2026-11-11']);
// Calendar days must remain correct when this check runs in a DST timezone.
assert.deepEqual(dates(['2026-10-31', '2026-11-01', '2026-11-07'], 'W', '2026-11-07'), ['2026-11-01', '2026-11-07']);

const loaded = workout('2026-11-11', 'loaded', { slots: [{ id: 'main', status: 'done', variants: [{ id: 'main' }, { id: 'alt' }], performed: {
  main: { sets: [{ weight: 40, reps: 10 }, { weight: 0, reps: 20 }] },
  alt: { sets: [{ weight: 12.5, reps: 3 }] },
} }] });
loaded.slots.push({ id: 'second', status: 'done', variants: [{ id: 'second' }], performed: { second: { sets: [{ weight: 60, reps: 2 }] } } });
const earlier = workout('2026-11-11', 'earlier', { completedAt: '2026-11-11T09:00:00Z' });
const tied = workout('2026-11-11', 'a');
const old = workout('2020-01-01', 'legacy', { legacy: true, completedAt: '2026-11-11T23:00:00Z' });
const data = { workouts: [loaded, tied, old, earlier, workout('2026-11-11', 'active', { status: 'active', completedAt: null })],
  drafts: { loaded: { 'main:main': [{ weight: 999, reps: 99 }] } }, groups: [{ items: [{ records: [{ weight: 999, reps: 99 }] }] }] };
const order = data.workouts.map(w => w.id);
const points = historyChartPoints(data, 'Y', '2026-11-11');
assert.deepEqual(points.map(p => p.id), ['legacy', 'earlier', 'a', 'loaded']);
assert.deepEqual(points.map(p => p.weight), [10, 10, 10, 557.5]);
assert.equal(points.at(-1).weight, workoutSummary(loaded).volume);
assert.deepEqual(data.workouts.map(w => w.id), order);
assert.deepEqual(historyChartPoints({ workouts: [] }, 'W', '2026-11-11'), []);
assert.equal(historyChartPoints({ workouts: Array.from({ length: 120 }, (_, i) => workout('2026-11-11', String(i))) }, 'Y', '2026-11-11').length, 120);
console.log('PASS history chart: periods, month ends/leap year/DST, stable per-workout ordering, external-load volume and exclusions (120 points retained)');
