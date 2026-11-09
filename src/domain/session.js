// Exercise session: the sets recorded for one variant of today's workout.
// Drafts hold raw input strings; saving validates them and writes catalog weight records.
import { uid, localDate, fail } from './shared.js';
import { findVariant, slotOf } from './program.js';
import { findItem, lastRecord } from './catalog.js';

export const sessionFor = (data, day, id) => data.sessions?.[day]?.[id];

// Starts a new draft prefilled from the last record, or reopens a saved session for editing.
export function startSession(data, day, id, now) {
  const exercise = findVariant(data, day, id);
  if (!exercise) return false;
  data.sessions ||= {};
  data.sessions[day] ||= {};
  const previous = data.sessions[day][id], record = lastRecord(findItem(data, exercise.weightId));
  const reps = Number(record?.reps);
  data.sessions[day][id] = previous ? { ...previous, completedAt: null } : {
    startedAt: now.toISOString(), completedAt: null,
    sets: [{ id: uid(), weight: record?.weight ?? '', reps: Number.isInteger(reps) && reps > 0 ? record.reps : '' }],
  };
}

const draftOf = (data, day, id) => {
  const session = sessionFor(data, day, id);
  return session && !session.completedAt ? session : null;
};

export function addSet(data, day, id) {
  const session = draftOf(data, day, id);
  if (!session) return false;
  const lastSet = session.sets.at(-1);
  session.sets.push({ id: uid(), weight: lastSet?.weight ?? '', reps: lastSet?.reps ?? '' });
}

export function removeSet(data, day, id, setId) {
  const session = draftOf(data, day, id);
  if (!session || session.sets.length === 1) return false;
  session.sets = session.sets.filter(s => s.id !== setId);
}

// Raw typing into a draft set; no validation until the session is saved.
export function editSet(data, day, id, setId, field, value) {
  const set = sessionFor(data, day, id)?.sets.find(s => s.id === setId);
  if (!set || !['weight', 'reps'].includes(field)) return false;
  set[field] = value;
}

export function completeSession(data, day, id, now) {
  const exercise = findVariant(data, day, id), session = draftOf(data, day, id);
  if (!exercise || !session) return false;
  const sets = session.sets.map(set => ({ ...set, weight: Number(String(set.weight).replace(',', '.')), reps: Number(set.reps) }));
  if (!sets.length || sets.some((set, i) => String(session.sets[i].weight).trim() === '' || !Number.isFinite(set.weight) || set.weight < 0 || !Number.isInteger(set.reps) || set.reps < 1))
    fail('Укажите вес от 0 кг и целое число повторений от 1 для каждого подхода.');
  const item = findItem(data, exercise.weightId);
  if (!item) fail('Упражнение отсутствует в базе. Добавьте его через каталог и выберите для тренировки.');
  // Replace only this session's records when saved sets are edited.
  const oldIds = new Set(session.recordIds || []);
  item.records = item.records.filter(r => !oldIds.has(r.id));
  const records = sets.map(set => ({ id: uid(), weight: set.weight, reps: set.reps, date: localDate(now), up: false }));
  item.records.push(...records);
  Object.assign(session, { recordIds: records.map(r => r.id), sets, completedAt: now.toISOString() });
  data.done[day] = [...new Set([...(data.done[day] || []), id, slotOf(data, day, id).id])];
}
