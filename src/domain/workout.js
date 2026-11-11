// Workouts: one run of a day template. A workout keeps its own snapshot of slots and variants, the variant chosen
// for this run and the sets actually saved, so later template edits never rewrite history.
// Drafts (unsaved input rows) live apart from saved sets in data.drafts[workoutId]['slotId:variantId'].
import { uid, localDate, fail } from './shared.js';
import { DAYS, variantsOf, sameMuscleGroup } from './program.js';

export const ROTATION = ['A', 'B', 'C'];

const variantSnapshot = v => ({ id: v.id, name: v.name, weightId: v.weightId ?? null, sets: v.sets, range: v.range });
const slotSnapshot = slot => ({ id: slot.id, name: slot.name, variants: variantsOf(slot).map(variantSnapshot), selectedId: slot.id, status: 'pending', performed: {} });

export const findWorkout = (data, id) => data.workouts.find(w => w.id === id);
export const activeWorkouts = data => data.workouts.filter(w => w.status === 'active');
export const activeWorkoutOf = (data, day) => data.workouts.find(w => w.status === 'active' && w.day === day) || null;
export const completedWorkouts = data => data.workouts.filter(w => w.status === 'completed').sort((a, b) => a.completedAt.localeCompare(b.completedAt));
export const lastCompleted = (data, day) => completedWorkouts(data).filter(w => !day || w.day === day).at(-1) || null;

// Queue A → B → C → A, driven only by the last completed A/B/C workout. ★ is outside the cycle.
export function nextDay(data) {
  const last = completedWorkouts(data).filter(w => ROTATION.includes(w.day)).at(-1);
  return last ? ROTATION[(ROTATION.indexOf(last.day) + 1) % ROTATION.length] : 'A';
}
export const dayAfter = day => ROTATION.includes(day) ? ROTATION[(ROTATION.indexOf(day) + 1) % ROTATION.length] : null;

export const findSlot = (workout, slotId) => workout?.slots.find(s => s.id === slotId) || null;
export const mainVariant = slot => slot.variants[0];
export const selectedVariant = slot => slot.variants.find(v => v.id === slot.selectedId) || mainVariant(slot);
export const setsOf = (slot, variantId) => slot.performed[variantId]?.sets || [];
export const slotSets = slot => slot.variants.flatMap(v => setsOf(slot, v.id));
export const workoutSets = workout => workout.slots.flatMap(slotSets);

/* ---------- Drafts ---------- */
const draftKey = (slotId, variantId) => slotId + ':' + variantId;
const isFilled = row => String(row.weight ?? '').trim() !== '' || String(row.reps ?? '').trim() !== '';
export const draftRow = (data, workoutId, slotId, variantId) => data.drafts[workoutId]?.[draftKey(slotId, variantId)]?.[0] || null;
const slotHasDraft = (data, workoutId, slot) => slot.variants.some(v => (data.drafts[workoutId]?.[draftKey(slot.id, v.id)] || []).some(isFilled));

// First slot/variant with a non-empty draft: finishing the workout must not silently drop typed input.
export function firstDraft(data, workout) {
  for (const slot of workout.slots) for (const v of slot.variants)
    if ((data.drafts[workout.id]?.[draftKey(slot.id, v.id)] || []).some(isFilled)) return { slotId: slot.id, variantId: v.id };
  return null;
}

// Values to prefill a new row: the previous set of this variant today, else the first set of its last completed run.
export function prefill(data, workout, slot, variantId) {
  const own = setsOf(slot, variantId).at(-1);
  if (own) return { weight: String(own.weight), reps: String(own.reps) };
  const weightId = slot.variants.find(v => v.id === variantId)?.weightId;
  const first = lastPerformance(data, weightId, workout.id)?.sets[0];
  return first ? { weight: String(first.weight), reps: String(first.reps) } : { weight: '', reps: '' };
}

export function openDraft(data, workoutId, slotId, variantId) {
  const workout = findWorkout(data, workoutId), slot = findSlot(workout, slotId);
  if (workout?.status !== 'active' || !slot) return false;
  const rows = ((data.drafts[workoutId] ||= {})[draftKey(slotId, variantId)] ||= []);
  if (!rows.length) rows.push(prefill(data, workout, slot, variantId));
}

export function editDraft(data, workoutId, slotId, variantId, field, value) {
  const row = draftRow(data, workoutId, slotId, variantId);
  if (!row || !['weight', 'reps'].includes(field)) return false;
  row[field] = value;
}

function dropDraftRow(data, workoutId, slotId, variantId) {
  const drafts = data.drafts[workoutId], key = draftKey(slotId, variantId);
  drafts?.[key]?.shift();
  if (drafts && !drafts[key]?.length) delete drafts[key];
  if (drafts && !Object.keys(drafts).length) delete data.drafts[workoutId];
}
export const cancelDraft = (data, workoutId, slotId, variantId) => draftRow(data, workoutId, slotId, variantId) ? dropDraftRow(data, workoutId, slotId, variantId) : false;

/* ---------- Sets ---------- */
// Weight as shown on the equipment: one dumbbell for dumbbell exercises, total load otherwise. Comma or dot as decimal separator.
export function parseSet(input) {
  const rawWeight = String(input.weight ?? '').trim(), rawReps = String(input.reps ?? '').trim();
  const weight = Number(rawWeight.replace(',', '.')), reps = Number(rawReps);
  if (rawWeight === '' || !Number.isFinite(weight) || weight < 0) fail('Вес — число от 0, например 40 или 22,5.');
  if (rawReps === '' || !Number.isInteger(reps) || reps < 1) fail('Повторения — целое число от 1.');
  return { weight, reps };
}

function slotRef(data, workoutId, slotId, variantId, { active = false } = {}) {
  const workout = findWorkout(data, workoutId), slot = findSlot(workout, slotId);
  if (!slot || (active && workout.status !== 'active') || (variantId && !slot.variants.some(v => v.id === variantId))) return null;
  return { workout, slot };
}

export function saveSet(data, workoutId, slotId, variantId, input) {
  const ref = slotRef(data, workoutId, slotId, variantId, { active: true });
  if (!ref) return false;
  const set = { id: uid(), ...parseSet(input) };
  (ref.slot.performed[variantId] ||= { sets: [] }).sets.push(set);
  if (ref.slot.status === 'skipped') ref.slot.status = 'pending';
  if (draftRow(data, workoutId, slotId, variantId)) dropDraftRow(data, workoutId, slotId, variantId);
  return set.id;
}

// Corrects a saved set, in an active or a completed workout.
export function updateSet(data, workoutId, slotId, variantId, setId, input) {
  const set = slotRef(data, workoutId, slotId, variantId) && setsOf(findSlot(findWorkout(data, workoutId), slotId), variantId).find(s => s.id === setId);
  if (!set) return false;
  Object.assign(set, parseSet(input));
}

export function removeSet(data, workoutId, slotId, variantId, setId) {
  const ref = slotRef(data, workoutId, slotId, variantId), sets = ref && setsOf(ref.slot, variantId);
  if (!sets?.some(s => s.id === setId)) return false;
  if (ref.workout.status === 'completed' && !ref.workout.legacy && workoutSets(ref.workout).length === 1)
    fail('Это последний подход завершённой тренировки, его нельзя удалить. Исправьте вес или повторы.');
  ref.slot.performed[variantId].sets = sets.filter(s => s.id !== setId);
  if (!ref.slot.performed[variantId].sets.length) delete ref.slot.performed[variantId];
  if (!slotSets(ref.slot).length && ref.slot.status === 'done' && !ref.slot.legacyDone)
    ref.slot.status = ref.workout.status === 'completed' ? 'skipped' : 'pending';
}

/* ---------- Slots ---------- */
export function slotStatus(data, workout, slot) {
  if (slot.status !== 'pending') return slot.status;
  return slotSets(slot).length || (workout.status === 'active' && slotHasDraft(data, workout.id, slot)) ? 'active' : 'pending';
}

export function workoutProgress(data, workout) {
  const done = workout.slots.filter(s => s.status === 'done').length, total = workout.slots.length;
  return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
}

// The choice applies to this workout only; the next one starts from the main exercise again.
export function selectVariant(data, workoutId, slotId, variantId) {
  const ref = slotRef(data, workoutId, slotId, variantId, { active: true });
  if (!ref || ref.slot.selectedId === variantId) return false;
  if (variantId !== ref.slot.id && !sameMuscleGroup(data, mainVariant(ref.slot).weightId, ref.slot.variants.find(v => v.id === variantId).weightId)) fail('Выберите альтернативу из той же группы мышц.');
  ref.slot.selectedId = variantId;
}

// Saves a filled draft of the chosen variant first, then marks the slot done. Needs at least one saved set.
export function completeSlot(data, workoutId, slotId) {
  const ref = slotRef(data, workoutId, slotId, null, { active: true });
  if (!ref) return false;
  const variant = selectedVariant(ref.slot), row = draftRow(data, workoutId, slotId, variant.id);
  if (row && isFilled(row)) saveSet(data, workoutId, slotId, variant.id, row);
  if (!slotSets(ref.slot).length) fail('Сначала сохраните хотя бы один подход.');
  ref.slot.status = 'done';
}

export function toggleSkip(data, workoutId, slotId) {
  const ref = slotRef(data, workoutId, slotId, null, { active: true });
  if (!ref) return false;
  if (ref.slot.status === 'skipped') { ref.slot.status = 'pending'; return; }
  if (slotSets(ref.slot).length) fail('В упражнении уже есть подходы. Завершите его или удалите подходы.');
  ref.slot.status = 'skipped';
}

/* ---------- Workout lifecycle ---------- */
export function startWorkout(data, day, now) {
  if (!DAYS.includes(day)) return false;
  if (activeWorkouts(data).length) fail('Уже идёт другая тренировка. Продолжите или завершите её.');
  const template = data.days[day] || [];
  if (!template.length) fail('В тренировке нет упражнений. Добавьте первое.');
  const workout = { id: uid(), day, status: 'active', startedAt: now.toISOString(), completedAt: null, date: localDate(now), slots: template.map(slotSnapshot) };
  data.workouts.push(workout);
  return workout.id;
}

// Partial finish is allowed: slots with sets are done, the rest skipped.
export function finishWorkout(data, workoutId, now) {
  const workout = findWorkout(data, workoutId);
  if (workout?.status !== 'active') return false;
  if (firstDraft(data, workout)) fail('Сохраните или удалите черновик подхода.');
  if (!workoutSets(workout).length && !workout.slots.some(s => s.legacyDone)) fail('Запишите хотя бы один подход или удалите занятие.');
  for (const slot of workout.slots) slot.status = slotSets(slot).length || slot.legacyDone ? 'done' : 'skipped';
  Object.assign(workout, { status: 'completed', completedAt: now.toISOString(), date: localDate(now) });
  delete data.drafts[workoutId];
}

export function deleteWorkout(data, workoutId) {
  const workout = findWorkout(data, workoutId);
  if (workout?.status !== 'active') return false;
  data.workouts = data.workouts.filter(w => w !== workout);
  delete data.drafts[workoutId];
}

/* ---------- Keeping an active workout in step with template edits ---------- */
export function addToActive(data, day, templateSlot, alternativeId = null) {
  const workout = activeWorkoutOf(data, day);
  if (!workout) return null;
  const slot = findSlot(workout, templateSlot.id);
  if (!alternativeId) { if (!slot) workout.slots.push(slotSnapshot(templateSlot)); return workout; }
  const alternative = templateSlot.alternatives.find(a => a.id === alternativeId);
  if (slot && alternative && !slot.variants.some(v => v.id === alternativeId)) slot.variants.push(variantSnapshot(alternative));
  return workout;
}

// Removes a slot or variant from the active workout too, unless sets were already saved for it.
export function removeFromActive(data, day, slotId, variantId = null) {
  const workout = activeWorkoutOf(data, day), slot = findSlot(workout, slotId);
  if (!slot) return;
  if (!variantId || variantId === slotId) {
    if (!slotSets(slot).length) { workout.slots = workout.slots.filter(s => s !== slot); data.drafts[workout.id] && Object.keys(data.drafts[workout.id]).filter(k => k.startsWith(slotId + ':')).forEach(k => delete data.drafts[workout.id][k]); }
    return;
  }
  if (setsOf(slot, variantId).length) return;
  slot.variants = slot.variants.filter(v => v.id !== variantId);
  if (slot.selectedId === variantId) slot.selectedId = slot.id;
  if (data.drafts[workout.id]) delete data.drafts[workout.id][draftKey(slotId, variantId)];
}

/* ---------- Statistics: always computed from saved sets of workouts ---------- */
// Dumbbell exercises (catalog equipment «Гантели»): the entered weight is ONE dumbbell, the load is the pair.
export const loadFactor = (data, weightId) => weightId && data.groups.some(g => g.items.some(i => i.id === weightId && i.equipment === 'dumbbells')) ? 2 : 1;
export const volumeOf = (sets, factor = 1) => factor * sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

// One set stands for a run: the heaviest; on equal weight the most reps; on a full tie the first.
export const representativeSet = sets => sets.reduce((best, s) => !best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best, null);

export function workoutSummary(data, workout) {
  const exercises = workout.slots.flatMap(slot => slot.variants.filter(v => setsOf(slot, v.id).length)
    .map(v => ({ slot, variant: v, sets: setsOf(slot, v.id), instead: v.id !== slot.id ? mainVariant(slot).name : null })));
  const sets = workoutSets(workout);
  return { done: workout.slots.filter(s => s.status === 'done').length, total: workout.slots.length, setCount: sets.length, volume: exercises.reduce((sum, e) => sum + volumeOf(e.sets, loadFactor(data, e.variant.weightId)), 0), exercises };
}

// Completed runs of one catalog exercise across all templates, oldest first. One entry per workout.
export function performancesOf(data, weightId) {
  if (!weightId) return [];
  return completedWorkouts(data).map(workout => ({
    workout,
    sets: workout.slots.flatMap(slot => slot.variants.filter(v => v.weightId === weightId).flatMap(v => setsOf(slot, v.id))),
  })).filter(p => p.sets.length);
}

export const lastPerformance = (data, weightId, exceptWorkoutId = null) => performancesOf(data, weightId).filter(p => p.workout.id !== exceptWorkoutId).at(-1) || null;

// Catalog exercises with completed history: last and previous representative sets.
export function progressList(data) {
  return data.groups.flatMap(g => g.items).map(item => {
    const runs = performancesOf(data, item.id);
    return runs.length ? { item, last: representativeSet(runs.at(-1).sets), previous: runs.length > 1 ? representativeSet(runs.at(-2).sets) : null, date: runs.at(-1).workout.date } : null;
  }).filter(Boolean);
}

export const historyNewestFirst = data => completedWorkouts(data).reverse();
