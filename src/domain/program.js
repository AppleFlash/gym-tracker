// Training program: day templates → slots → variants (the main exercise plus saved alternatives).
// Templates are permanent; what happens in one run lives in workouts (workout.js).
// Mutating functions change the given draft and return false when there is nothing to do.
import { uid, fail } from './shared.js';

export const DAYS = ['A', 'B', 'C', 'star'];

export const variantsOf = exercise => [exercise, ...(exercise.alternatives || [])];
export const findVariant = (data, day, id) => (data.days[day] || []).flatMap(variantsOf).find(e => e.id === id);
// The program slot (main exercise) that owns a variant id.
export const slotOf = (data, day, id) => (data.days[day] || []).find(e => variantsOf(e).some(v => v.id === id));

// Whether a catalog item is already used by the day (or by one slot's variants when parentId is given).
export function isInProgram(data, day, parentId, itemId) {
  const entries = parentId ? variantsOf(slotOf(data, day, parentId) || { alternatives: [] }) : data.days[day] || [];
  return entries.some(e => e.weightId === itemId);
}

// Adds a catalog item as a new slot of the day, or as an alternative of a slot (never a duplicate).
export function addFromCatalog(data, day, parentId, item) {
  if (!item || isInProgram(data, day, parentId, item.id)) return false;
  const parent = parentId ? slotOf(data, day, parentId) : null;
  if (parentId && !parent) return false;
  const entry = { id: uid(), name: item.name, weightId: item.id, sets: parent?.sets || 3, range: parent?.range || '8–12' };
  if (parent) (parent.alternatives ||= []).push(entry);
  else data.days[day].push(entry);
  return { slot: parent || entry, entryId: entry.id, alternative: !!parent };
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

// Removes a slot, or one alternative of it. Catalog items and their history stay.
export function removeFromProgram(data, day, id) {
  const slot = slotOf(data, day, id);
  if (!slot) return false;
  if (id === slot.id) data.days[day] = data.days[day].filter(e => e.id !== id);
  else slot.alternatives = slot.alternatives.filter(e => e.id !== id);
  return { slotId: slot.id };
}
