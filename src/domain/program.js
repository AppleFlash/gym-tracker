// Training program: day → exercise slots → variants (the original exercise plus its alternatives).
// Mutating functions change the given draft and return false when there is nothing to do.
import { uid, fail } from './shared.js';

export const DAYS = ['A', 'B', 'C', 'star'];

export const variantsOf = exercise => [exercise, ...(exercise.alternatives || [])];
export const findVariant = (data, day, id) => (data.days[day] || []).flatMap(variantsOf).find(e => e.id === id);
// The program slot (original exercise) that owns a variant id.
export const slotOf = (data, day, id) => (data.days[day] || []).find(e => variantsOf(e).some(v => v.id === id));
export const activeVariant = exercise => exercise.alternatives?.find(e => e.id === exercise.selectedId) || exercise;
export const isDone = (data, day, id) => (data.done[day] || []).includes(id);

export function dayProgress(data, day) {
  const exercises = data.days[day] || [], done = exercises.filter(e => isDone(data, day, e.id)).length;
  return { done, total: exercises.length, pct: exercises.length ? Math.round(done / exercises.length * 100) : 0 };
}

export function toggleDone(data, day, id) {
  const slot = slotOf(data, day, id);
  if (!slot) return false;
  const ids = new Set(variantsOf(slot).map(e => e.id)), done = data.done[day] || [];
  data.done[day] = done.includes(slot.id) ? done.filter(value => !ids.has(value)) : [...new Set([...done, slot.id, activeVariant(slot).id])];
}

export function selectVariant(data, day, id, variantId) {
  const slot = slotOf(data, day, id);
  if (!slot || !variantsOf(slot).some(v => v.id === variantId)) return false;
  slot.selectedId = variantId;
}

export const toggleToday = (data, day) => { data.today = data.today === day ? null : day; };

// Whether a catalog item is already used by the day (or by one slot's variants when parentId is given).
export function isInProgram(data, day, parentId, itemId) {
  const entries = parentId ? variantsOf(slotOf(data, day, parentId) || { alternatives: [] }) : data.days[day] || [];
  return entries.some(e => e.weightId === itemId);
}

// Adds a catalog item to the day or as an alternative of a slot. Returns the row id to reveal.
export function addFromCatalog(data, day, parentId, item) {
  if (!item || isInProgram(data, day, parentId, item.id)) return false;
  const parent = parentId ? slotOf(data, day, parentId) : null;
  if (parentId && !parent) return false;
  const entry = { id: uid(), name: item.name, weightId: item.id, sets: parent?.sets || 3, range: parent?.range || '8–12' };
  if (parent) (parent.alternatives ||= []).push(entry);
  else data.days[day].push(entry);
  return { rowId: parent?.id || entry.id, alternativeOf: parent?.id || null };
}

export function setExerciseParams(data, day, id, { sets, range }) {
  const exercise = findVariant(data, day, id);
  if (!exercise) return false;
  if (!Number.isInteger(sets) || sets < 1) fail('Подходы должны быть целым числом');
  Object.assign(exercise, { sets, range: String(range || '').trim() });
}

export function moveExercise(data, day, from, to) {
  const list = data.days[day];
  list.splice(to, 0, list.splice(from, 1)[0]);
}

export function removeFromProgram(data, day, id) {
  const slot = slotOf(data, day, id);
  if (!slot) return false;
  const done = data.done[day] || [];
  const removed = new Set(id === slot.id ? variantsOf(slot).map(e => e.id) : [id]);
  if (id === slot.id) data.days[day] = data.days[day].filter(e => e.id !== id);
  else {
    slot.alternatives = slot.alternatives.filter(e => e.id !== id);
    if (slot.selectedId === id) delete slot.selectedId;
    // A removed variant no longer supplies completion for this program slot.
    const otherCompleted = variantsOf(slot).some(e => e.id !== slot.id && done.includes(e.id));
    if (done.includes(id) && !otherCompleted && !data.sessions?.[day]?.[slot.id]?.completedAt) removed.add(slot.id);
  }
  if (data.sessions?.[day]) for (const removedId of removed) if (removedId !== slot.id || id === slot.id) delete data.sessions[day][removedId];
  data.done[day] = done.filter(value => !removed.has(value));
}

export function resetDay(data, day) {
  data.done[day] = [];
  if (data.sessions) data.sessions[day] = {};
}

// Which day to offer first: the one marked for today, else one already in progress, else the next in A→B→C rotation.
export function suggestedDay(data) {
  if (data.today) return { day: data.today, reason: 'today' };
  const started = DAYS.find(day => { const p = dayProgress(data, day); return p.done > 0 && p.done < p.total; });
  if (started) return { day: started, reason: 'started' };
  const rotation = ['A', 'B', 'C'];
  return { day: rotation[(rotation.indexOf(data.lastDay) + 1) % rotation.length], reason: 'next' };
}

export const nextSlot = (data, day) => (data.days[day] || []).find(e => !isDone(data, day, e.id));
