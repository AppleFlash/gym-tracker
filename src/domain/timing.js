// Workout time analytics, derived from raw stamps only (seconds since epoch):
//   set.t   — the moment the set was added (workout and exercise start = the earliest set.t),
//   slot.t1 — the moment the exercise was finished; workout end = completedAt.
// Rest never depends on the "finish exercise" tap: it is measured between set stamps only. Old data without stamps → null.
import { slotSets } from './workout.js';

// Calibration knobs. A set is logged after it ends, so the time to the next stamp holds that next set's execution
// besides the rest; the execution is estimated as reps × SECONDS_PER_REP and subtracted. Rest values are estimates.
export const SECONDS_PER_REP = 4;
export const LONG_PAUSE = 1.5; // a pause is long above this multiple of the workout's median pause of its kind

const sum = list => list.reduce((a, b) => a + b, 0);
const median = list => { const s = [...list].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// The norm of a kind of pause is its median in this workout; fewer than 3 pauses give no norm (null).
const normOf = list => list.length < 3 ? null : median(list);
// Seconds above the norm over all long pauses.
const excess = list => { const m = normOf(list); return m === null ? 0 : sum(list.filter(v => v > LONG_PAUSE * m).map(v => v - m)); };
const minusSet = (seconds, reps) => Math.max(0, seconds - reps * SECONDS_PER_REP);

// nowSec ends an active workout; without it an active workout ends at its latest exercise end.
// Per exercise: dur (first set → finish tap), iv (raw seconds between consecutive sets), rest (iv without the next set's
// execution), gap (last set of the previous exercise → first set of this one, without its execution; 0 for the first).
// sets: the stamped sets of the exercise in time order (all its variants).
// norm.rest / norm.move: the usual pause of this workout; a pause is long when above LONG_PAUSE × its norm.
export function timing(workout, nowSec = null) {
  const done = workout.completedAt ? Math.floor(Date.parse(workout.completedAt) / 1000) : nowSec;
  const ex = workout.slots.flatMap(slot => {
    const sets = slotSets(slot).filter(s => Number.isFinite(s.t)).sort((a, b) => a.t - b.t);
    if (!sets.length) return [];
    const last = sets.at(-1).t, t1 = Math.max(slot.t1 ?? last, last); // never before the last set, whatever the clock did
    const pairs = sets.slice(1).map((s, i) => [s.t - sets[i].t, s.reps]);
    return [{ slotId: slot.id, sets, t0: sets[0].t, last, t1, dur: t1 - sets[0].t, first: sets[0].reps, iv: pairs.map(p => p[0]), rest: pairs.map(p => minusSet(...p)) }];
  }).sort((a, b) => a.t0 - b.t0);
  if (!ex.length) return null;
  let reach = null; // ponytail: overlapping exercises (supersets) get gap 0 and are not merged; union them if they ever matter
  for (const e of ex) { e.gap = reach === null ? 0 : minusSet(Math.max(0, e.t0 - reach), e.first); reach = Math.max(reach ?? 0, e.last); }
  const rests = ex.flatMap(e => e.rest), moves = ex.slice(1).map(e => e.gap), t0 = ex[0].t0, t1 = Math.max(done ?? 0, ...ex.map(e => e.t1));
  return { t0, t1, dur: t1 - t0, rest: sum(rests), move: sum(moves), over: Math.round(excess(rests) + excess(moves)), norm: { rest: normOf(rests), move: normOf(moves) }, ex };
}

// Every pause of a workout in time order, for drawing. si 0 is the pause before exercise ei, si > 0 the rest before its set si.
// A pause is long above LONG_PAUSE × the norm of its kind; the long ones add up to tm.over.
export function pausesOf(tm) {
  const list = [];
  tm.ex.forEach((e, ei) => {
    if (ei > 0) list.push({ kind: 'move', sec: e.gap, ei, si: 0 });
    e.rest.forEach((sec, i) => list.push({ kind: 'rest', sec, ei, si: i + 1 }));
  });
  return list.map((p, k) => { const norm = tm.norm[p.kind]; return { ...p, k, norm, long: norm !== null && p.sec > LONG_PAUSE * norm }; });
}
