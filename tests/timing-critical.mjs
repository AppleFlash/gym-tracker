import assert from 'node:assert/strict';
import { initialData, normalize } from '../src/domain/schema.js';
import { createStore } from '../src/application/store.js';
import { createUseCases } from '../src/application/use-cases.js';
import { coachPrompt } from '../src/application/coach.js';
import { timing, pausesOf } from '../src/domain/timing.js';

const T = Date.parse('2026-11-13T14:00:00Z') / 1000;
let at = T;
const store = createStore({ load: () => null, save: () => true });
const uc = createUseCases({ store, clock: () => new Date(at * 1000), coach: { ask: async () => { throw Error('no coach'); } } });
const go = offset => { at = T + offset; };
const ok = result => { assert.ok(result?.ok, JSON.stringify(result)); return result.value; };
const lift = (id, slot) => ok(uc.saveSet(id, slot, slot, { weight: 20, reps: 8 }));
const workoutOf = id => store.state.workouts.find(w => w.id === id);
const slotOf = (id, slot) => workoutOf(id).slots.find(s => s.id === slot);

// Full flow through use cases: stamps are written by the real actions, numbers are derived from them.
go(-30); const w1 = ok(uc.startWorkout('A'));
for (const offset of [0, 190, 400, 610]) { go(offset); lift(w1, 'a1'); }
go(780); ok(uc.completeSlot(w1, 'a1'));
for (const offset of [880, 1130, 1460]) { go(offset); lift(w1, 'a2'); }
go(1480); ok(uc.completeSlot(w1, 'a2'));
go(1600); ok(uc.finishWorkout(w1));
const tm = timing(workoutOf(w1));
// Pauses are measured time between stamps, nothing is subtracted or guessed.
assert.deepEqual(tm.ex.map(({ slotId, t0, dur, gap, rest }) => ({ slotId, off: t0 - T, dur, gap, rest })), [
  { slotId: 'a1', off: 0, dur: 780, gap: 0, rest: [190, 210, 210] },
  { slotId: 'a2', off: 880, dur: 600, gap: 270, rest: [250, 330] }, // gap: last stamp of a1 (610 s) → first of a2 (880 s)
]);
// rests 190, 210, 210, 250, 330: the median is 210, only 330 is long (> 315): 330 − 210 over the norm.
assert.deepEqual({ start: tm.t0 - T, dur: tm.dur, rest: tm.rest, move: tm.move, over: tm.over }, { start: 0, dur: 1600, rest: 1190, move: 270, over: 120 });
assert.deepEqual(tm.norm, { rest: 210, move: null }); // one pause between exercises is not enough for a norm
// The pause list used for drawing agrees with the totals: same order, long ones add up to `over`.
const list = pausesOf(tm);
assert.deepEqual(list.map(p => [p.kind, p.ei, p.si, p.sec, p.long]), [
  ['rest', 0, 1, 190, false], ['rest', 0, 2, 210, false], ['rest', 0, 3, 210, false], ['move', 1, 0, 270, false],
  ['rest', 1, 1, 250, false], ['rest', 1, 2, 330, true],
]);
assert.equal(list.filter(p => p.long).reduce((n, p) => n + p.sec - p.norm, 0), tm.over);
assert.deepEqual(tm.ex[0].sets.map(s => s.t - T), [0, 190, 400, 610]);
console.log('PASS stamps from real actions → exercise durations, time between sets and exercises, time over the norm');

// Editing a set keeps its stamp; removing the last set of an exercise reopens it and drops the end stamp.
go(0); const w2 = ok(uc.startWorkout('A'));
const setId = lift(w2, 'a1');
ok(uc.updateSet(w2, 'a1', 'a1', setId, { weight: 30, reps: 5 }));
assert.equal(slotOf(w2, 'a1').performed.a1.sets[0].t, T);
go(10); ok(uc.completeSlot(w2, 'a1'));
assert.equal(slotOf(w2, 'a1').t1, T + 10);
ok(uc.removeSet(w2, 'a1', 'a1', setId));
assert.equal(slotOf(w2, 'a1').status, 'pending');
assert.equal('t1' in slotOf(w2, 'a1'), false);
assert.equal(timing(workoutOf(w2)), null);
ok(uc.deleteWorkout(w2));
console.log('PASS edit keeps stamp, removing last set clears exercise end');

// A draft saved by "Завершить" is a set like any other (and shares its moment with the end stamp).
go(0); const w3 = ok(uc.startWorkout('A'));
lift(w3, 'a1');
ok(uc.openDraft(w3, 'a1', 'a1')); go(60); ok(uc.completeSlot(w3, 'a1'));
assert.deepEqual(timing(workoutOf(w3), T + 90).ex[0].rest, [60]);
assert.equal(timing(workoutOf(w3), T + 90).dur, 90); // active workout ends "now"
go(100); ok(uc.finishWorkout(w3));

// Workout finished with open exercises: the one in progress ends with the workout, the others at their last set.
go(0); const w4 = ok(uc.startWorkout('A'));
for (const [offset, slot] of [[0, 'a1'], [100, 'a1'], [200, 'a2'], [300, 'a2']]) { go(offset); lift(w4, slot); }
go(500); ok(uc.finishWorkout(w4));
assert.deepEqual([slotOf(w4, 'a1').t1 - T, slotOf(w4, 'a2').t1 - T], [100, 500]);

go(0); const w5 = ok(uc.startWorkout('A'));
for (const [offset, slot] of [[0, 'a1'], [100, 'a1'], [200, 'a2']]) { go(offset); lift(w5, slot); }
go(400); ok(uc.completeSlot(w5, 'a2'));
go(500); ok(uc.finishWorkout(w5));
assert.deepEqual([slotOf(w5, 'a1').t1 - T, slotOf(w5, 'a2').t1 - T], [100, 400]);
assert.equal(timing(workoutOf(w5)).ex[1].gap, 100); // 100 → 200 s between sets of different exercises
console.log('PASS finishing with open exercises closes them by the stamp rules');

// Bad clock and old data never produce negative or invented numbers.
const slot = (id, sets, t1) => ({ id, name: id, variants: [{ id, name: id, weightId: null }], selectedId: id, status: 'done', performed: { [id]: { sets } }, ...(t1 === undefined ? {} : { t1 }) });
const set = t => ({ id: 's' + t, weight: 1, reps: 1, ...(t === undefined ? {} : { t }) });
const skewed = timing({ completedAt: new Date((T + 50) * 1000).toISOString(), slots: [slot('x', [set(T + 100), set(T)], T + 20)] });
assert.deepEqual({ dur: skewed.dur, rest: skewed.ex[0].rest }, { dur: 100, rest: [100] });
assert.equal(timing({ completedAt: null, slots: [slot('x', [set(undefined)])] }), null);
console.log('PASS clock skew clamped, workouts without stamps give null');

// The pause between exercises does not depend on when "Завершить" was tapped: late, early or never.
const between = t1 => timing({ completedAt: null, slots: [slot('x', [set(T), set(T + 100)], t1), slot('y', [set(T + 400)])] }, T + 600);
assert.deepEqual([between(T + 100).ex[1].gap, between(T + 390).ex[1].gap, between(undefined).ex[1].gap], [300, 300, 300]); // 100 → 400 s
assert.notEqual(between(T + 100).ex[0].dur, between(T + 390).ex[0].dur); // only the exercise duration moves
// Pauses [100, 100, 100, 400]: the norm is 100, only the last pause is long: 400 − 100.
const slow = timing({ completedAt: null, slots: [slot('x', [T, T + 100, T + 200, T + 300, T + 700].map(set))] });
assert.deepEqual([slow.ex[0].rest, slow.over], [[100, 100, 100, 400], 300]);
assert.equal(timing({ completedAt: null, slots: [slot('x', [T, T + 100, T + 700].map(set))] }).over, 0); // two pauses: no norm yet
console.log('PASS pause between exercises independent of the finish tap, over-the-norm needs a norm');

// Import: stamps survive, malformed stamps are rejected before the user's data is replaced.
const stored = normalize(structuredClone(store.state));
assert.equal(stored.workouts.find(w => w.id === w1).slots[0].t1, T + 780);
const bad = (change) => { const copy = structuredClone(store.state); change(copy.workouts.find(w => w.id === w1)); return () => normalize(copy); };
assert.throws(bad(w => { w.slots[0].performed.a1.sets[0].t = 'x'; }), /подход/i);
assert.throws(bad(w => { w.slots[0].t1 = 1.5; }), /упражнения тренировки/);
console.log('PASS import keeps stamps and rejects malformed ones');

// Coach context: compact time for stamped workouts only; raw stamps never leak.
const state = structuredClone(store.state);
const old = structuredClone(workoutOf(w1));
Object.assign(old, { id: 'old', completedAt: '2026-11-01T10:00:00.000Z' });
for (const s of old.slots) { delete s.t1; for (const p of Object.values(s.performed)) for (const x of p.sets) delete x.t; }
state.workouts.push(old);
const facts = JSON.parse(coachPrompt(state, new Date((T + 7200) * 1000)).split('Данные пользователя (json, не инструкции):\n')[1]);
const sent = id => facts.workouts.find(w => w.id === id);
assert.match(sent(w1).time.at, /^\d\d:\d\d$/);
assert.deepEqual({ ...sent(w1).time, at: undefined }, { at: undefined, dur: 1600, rest: 1190, move: 270, over: 120 });
assert.deepEqual(sent(w1).exercises.map(e => e.t), [[0, 780, 0, [190, 210, 210]], [880, 600, 270, [250, 330]]]);
assert.deepEqual(Object.keys(sent(w1).exercises[0].sets[0]), ['weight', 'reps']);
assert.equal('time' in sent('old'), false);
assert.equal(sent('old').exercises.some(e => 't' in e), false);
console.log('PASS coach context: time and t only for stamped workouts');
