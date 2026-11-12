// Time of one finished workout: how much rest was longer than usual, where, and what the usual rest is.
// Everything is derived from set stamps by domain/timing.js; this screen only arranges it.
import { findWorkout } from '../../domain/workout.js';
import { timing, pausesOf, SECONDS_PER_REP } from '../../domain/timing.js';
import { data } from '../context.js';
import { esc, nice, minSec, timeLabel, plural } from '../format.js';
import { go } from '../router.js';
import { rhythmStrip } from '../components/rhythm-strip.js';
import { setChain } from '../components/set-chain.js';
import { pauseBar } from '../components/pause-bar.js';
import { valueRow } from '../components/value-row.js';

const LEGEND = [['set', 'подход'], ['ok', 'отдых'], ['long', 'дольше обычного']];
const longest = list => list.reduce((a, b) => (b.sec > a.sec ? b : a), list[0]);

export function timePage(workoutId) {
  const workout = findWorkout(data(), workoutId), tm = workout?.status === 'completed' ? timing(workout) : null;
  if (!tm) return '<h1>Время</h1><div class="empty">Для этой тренировки время не записано.</div>';

  // The exercise is named by the variant that was really performed.
  const names = tm.ex.map(e => { const slot = workout.slots.find(s => s.id === e.slotId); return (slot.variants.find(v => (slot.performed[v.id]?.sets || []).includes(e.sets[0])) || { name: slot.name }).name; });
  const pauses = pausesOf(tm), at = (ei, si) => pauses.find(p => p.ei === ei && p.si === si);
  const rests = pauses.filter(p => p.kind === 'rest'), moves = pauses.filter(p => p.kind === 'move'), longs = pauses.filter(p => p.long);
  const worst = longs.reduce((a, b) => (!a || b.sec - b.norm > a.sec - a.norm ? b : a), null);
  const where = p => p.kind === 'move' ? `перед «${names[p.ei]}»` : `в «${names[p.ei]}», между ${p.si} и ${p.si + 1} подходом`;

  const segments = [];
  tm.ex.forEach((e, ei) => e.sets.forEach((s, si) => {
    const p = at(ei, si);
    if (p) segments.push(p.long ? { kind: 'long', sec: p.sec, pause: p.k, label: `Долгая пауза ${minSec(p.sec)}, показать` } : { kind: 'ok', sec: p.sec });
    if (p || ei > 0 || si > 0) segments.push({ kind: 'set', sec: s.reps * SECONDS_PER_REP }); // the first set of the workout happened before its own stamp
  }));
  const tail = tm.t1 - tm.ex.at(-1).last;
  if (tail > 0) segments.push({ kind: 'tail', sec: tail });

  const minutes = Math.max(1, Math.round(tm.dur / 60)), moveScale = moves.length ? Math.ceil(longest(moves).sec / 60) * 60 : 60;
  const avgReps = tm.ex.flatMap(e => e.sets).reduce((n, s, _, all) => n + s.reps / all.length, 0);
  const meta = e => e.rest.length > 1 ? `в среднем <span class="num">${minSec(e.rest.reduce((a, b) => a + b, 0) / e.rest.length)}</span>` : e.rest.length ? `отдых <span class="num">${minSec(e.rest[0])}</span>` : '';

  const flow = tm.ex.map((e, ei) => {
    const move = ei > 0 ? at(ei, 0) : null;
    return (move ? pauseBar({ pause: move.k, label: `Пауза перед «${names[ei]}»`, text: minSec(move.sec), sec: move.sec, max: moveScale, long: move.long }) : '')
      + setChain({ title: names[ei], meta: meta(e), sets: e.sets.map((s, si) => { const p = si ? at(ei, si) : null; return { label: `${nice(s.weight)} × ${s.reps}`, rest: p && { pause: p.k, text: minSec(p.sec), sec: p.sec, long: p.long } }; }) });
  }).join('');

  const usual = [
    tm.norm.rest !== null ? valueRow({ title: 'Отдых между подходами', hint: `дольше всего ${minSec(longest(rests).sec)}`, value: minSec(tm.norm.rest) }) : '',
    tm.norm.move !== null ? valueRow({ title: 'Пауза между упражнениями', hint: `дольше всего ${minSec(longest(moves).sec)}`, value: minSec(tm.norm.move) }) : '',
    valueRow({ title: 'Один подход', hint: 'оценка по повторам', value: '≈ ' + minSec(avgReps * SECONDS_PER_REP) }),
  ].join('');

  return `<h1>Время</h1>
    <section class="card time-hero">
      <div class="th-top"><span class="th-num">${minSec(tm.over)}</span><span class="th-label">лишнего отдыха</span></div>
      <p class="th-sub">${longs.length ? `За ${minutes} мин: ${plural(longs.length, ['пауза', 'паузы', 'пауз'])} дольше обычного.` : `За ${minutes} мин долгих пауз нет.`}</p>
      ${rhythmStrip({ segments, labels: [timeLabel(tm.t0 * 1000), timeLabel((tm.t0 + tm.t1) / 2 * 1000), timeLabel(tm.t1 * 1000)], legend: LEGEND })}
      ${worst ? `<p class="th-sub">Дольше всего: ${esc(where(worst))}, ${minSec(worst.sec)} при обычных ${minSec(worst.norm)}.</p><button class="text-btn" data-action="showPause" data-pause="${worst.k}">Показать</button>` : ''}
    </section>
    <h2 class="group-title">Обычно</h2><section class="card list">${usual}</section>
    <div class="time-flow">${flow}</div>`;
}

export const actions = { openTime: ({ id }) => go('time', id) };
