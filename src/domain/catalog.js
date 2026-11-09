// Exercise catalog: muscle groups → exercises → weight records. Weight history belongs to the catalog item.
import { uid, fail } from './shared.js';
import { variantsOf } from './program.js';

export const catalogItems = data => data.groups.flatMap(g => g.items);
export const findItem = (data, id) => catalogItems(data).find(x => x.id === id);
export const findGroup = (data, id) => data.groups.find(g => g.id === id);
export const groupItem = (data, groupId, id) => findGroup(data, groupId)?.items.find(i => i.id === id);
export const lastRecord = item => item?.records?.[item.records.length - 1];

const sameName = (a, b) => a.trim().toLowerCase() === b.toLowerCase();
const programVariants = data => Object.values(data.days).flatMap(entries => entries.flatMap(variantsOf));

// Guess a muscle group from an exercise name: [id, display name].
export function muscleSpec(name) {
  const value = name.toLowerCase();
  return /трицепс/.test(value) ? ['triceps', 'Трицепс']
    : /бицепс|молотк/.test(value) ? ['biceps', 'Бицепс']
    : /дельт|мах|плеч|face pull|ohp/.test(value) ? ['shoulders', 'Плечи']
    : /ног|присед|румын|икр/.test(value) ? ['legs', 'Ноги']
    : /тяг|подтяг/.test(value) ? ['back', 'Спина']
    : /жим|отжим|груд/.test(value) ? ['chest', 'Грудь']
    : ['other', 'Другие'];
}

export function addGroup(data, rawName) {
  const name = String(rawName || '').trim();
  if (!name) fail('Введите название');
  if (data.groups.some(g => sameName(g.name, name))) fail('Такая группа уже есть');
  const group = { id: uid(), name, items: [] };
  data.groups.push(group);
  return group.id;
}

// Creates an exercise in a group, or renames it everywhere it is used when id is given.
export function saveItem(data, groupId, id, rawName) {
  const name = String(rawName || '').trim();
  if (!name) fail('Введите название');
  const group = findGroup(data, groupId);
  if (!group) return false;
  if (group.items.some(i => i.id !== id && sameName(i.name, name))) fail('Упражнение с таким названием уже есть в группе');
  if (!id) {
    const item = { id: uid(), name, records: [] };
    group.items.push(item);
    return item.id;
  }
  const item = group.items.find(i => i.id === id);
  if (!item) return false;
  item.name = name;
  for (const exercise of programVariants(data)) if (exercise.weightId === item.id) exercise.name = name;
  return item.id;
}

export function groupDeleteError(data, groupId) {
  const group = findGroup(data, groupId);
  return group && programVariants(data).some(e => group.items.some(i => i.id === e.weightId))
    ? 'Группа используется в программе. Сначала удалите её упражнения из тренировок и аналогов.' : null;
}

export function deleteGroup(data, groupId) {
  const error = groupDeleteError(data, groupId);
  if (error) fail(error);
  data.groups = data.groups.filter(g => g.id !== groupId);
}

// input: raw form values {weight, reps, date, up}. Reps may be a range like "8–10".
export function saveRecord(data, { group, id, recordId }, input) {
  const item = groupItem(data, group, id);
  if (!item) return false;
  const weight = Number(String(input.weight || '').replace(',', '.'));
  if (!input.weight || !Number.isFinite(weight) || weight <= 0) fail('Укажите положительный вес');
  const reps = String(input.reps || '').trim();
  const fields = { weight, reps: reps === '' ? null : reps, date: String(input.date || '') || null, up: !!input.up };
  const record = recordId && item.records.find(r => r.id === recordId);
  if (record) Object.assign(record, fields);
  else item.records.push({ id: uid(), ...fields });
}

export function removeRecord(data, { group, id, recordId }) {
  const item = groupItem(data, group, id);
  if (!item) return false;
  item.records = item.records.filter(r => r.id !== recordId);
}

// Latest record with its change against the previous one; record = heavier than every earlier entry.
export function recordTrend(item) {
  const records = item?.records || [], last = records.at(-1);
  if (!last) return null;
  const weight = r => Number(r.weight) || 0, earlier = records.slice(0, -1);
  return { last, delta: earlier.length ? weight(last) - weight(earlier.at(-1)) : 0, record: earlier.length > 0 && weight(last) > Math.max(...earlier.map(weight)) };
}
