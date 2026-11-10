// Exercise catalog: muscle groups → exercises. Stable ids link program variants and workout sets to one exercise.
import { uid, fail } from './shared.js';
import { DAYS, variantsOf } from './program.js';
import { performancesOf, representativeSet } from './workout.js';

export const EQUIPMENT = { barbell: 'Штанга', dumbbells: 'Гантели', cable: 'Блок', machine: 'Тренажёр', bodyweight: 'Свой вес', other: 'Другое' };
export const searchKey = value => String(value).trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
export const itemDefaults = () => ({ equipment: null, favorite: false, aliases: [], note: '', archived: false, technique: null });
export const usedDays = (data, id) => DAYS.filter(day => data.days[day].some(e => variantsOf(e).some(v => v.weightId === id)));
export const itemGroup = (data, id) => data.groups.find(g => g.items.some(i => i.id === id));

export function itemUsage(data, id) {
  return [...usedDays(data, id).map(day => ({ day, active: false })), ...data.workouts.filter(w => w.status === 'active' && w.slots.some(s => s.variants.some(v => v.weightId === id))).map(w => ({ day: w.day, active: true }))];
}

export function catalogList(data, { query = '', mode = 'all', group = '', equipment = '' } = {}) {
  const q = searchKey(query);
  return data.groups.flatMap(g => g.items.map(item => {
    const name = searchKey(item.name), aliases = item.aliases.map(searchKey), days = usedDays(data, item.id);
    const rank = !q || name === q ? 0 : aliases.includes(q) ? 1 : name.includes(q) ? 2 : aliases.some(a => a.includes(q)) ? 3 : -1;
    const last = performancesOf(data, item.id).at(-1);
    return { item, group: g, days, rank, last, set: last ? representativeSet(last.sets) : null };
  })).filter(r => r.rank >= 0 && (mode === 'archived' ? r.item.archived : !r.item.archived)
    && (mode !== 'favorites' || r.item.favorite) && (mode !== 'program' || r.days.length)
    && (!group || r.group.id === group) && (!equipment || (equipment === 'unknown' ? !r.item.equipment : r.item.equipment === equipment)))
    .sort((a, b) => a.rank - b.rank || Number(b.item.favorite) - Number(a.item.favorite)
      || (!a.item.favorite && !b.item.favorite ? (b.last?.workout.completedAt || '').localeCompare(a.last?.workout.completedAt || '') : 0)
      || a.item.name.localeCompare(b.item.name, 'ru') || a.item.id.localeCompare(b.item.id));
}

export function validateItemFields(item) {
  const text = (v, max, required = false) => typeof v === 'string' && v.length <= max && (!required || v.trim().length > 0);
  if (!(item.equipment === null || Object.hasOwn(EQUIPMENT, item.equipment)) || typeof item.favorite !== 'boolean' || typeof item.archived !== 'boolean'
    || !text(item.note, 4000) || !Array.isArray(item.aliases) || item.aliases.length > 20 || item.aliases.some(a => !text(a, 200, true))
    || new Set(item.aliases.map(searchKey)).size !== item.aliases.length) throw Error('Неверные свойства упражнения');
  if (item.technique !== null) {
    const t = item.technique;
    if (!t || !['setup', 'movement', 'attention', 'mistakes'].every(k => text(t[k], 2000, true)) || !['manual', 'ai', 'ai-edited'].includes(t.source)
      || !(t.model === null || text(t.model, 200)) || typeof t.updatedAt !== 'string' || !Number.isFinite(Date.parse(t.updatedAt))) throw Error('Неверный формат памятки');
  }
}

export function saveProperties(data, id, input) {
  const oldGroup = id ? itemGroup(data, id) : null, group = findGroup(data, input.groupId);
  if (!group || (id && !oldGroup)) fail('Группа или упражнение больше не доступны.');
  const name = String(input.name || '').trim();
  if (!name || name.length > 200) fail('Название должно содержать от 1 до 200 символов.');
  if (group.items.some(i => i.id !== id && searchKey(i.name) === searchKey(name))) fail('Такое упражнение уже есть в этой группе. Откройте существующее.');
  const item = id ? findItem(data, id) : { id: uid(), records: [], ...itemDefaults() };
  const fields = { ...item, name, equipment: input.equipment || null, aliases: input.aliases, note: input.note };
  try { validateItemFields(fields); } catch (e) { fail(e.message); }
  Object.assign(item, fields);
  if (oldGroup && oldGroup !== group) oldGroup.items = oldGroup.items.filter(i => i !== item);
  if (!oldGroup || oldGroup !== group) group.items.push(item);
  for (const e of programVariants(data)) if (e.weightId === item.id) e.name = name;
  return item.id;
}

export function archiveItem(data, id, archived) {
  const item = findItem(data, id);
  if (!item) return false;
  if (archived && itemUsage(data, id).length) fail('Упражнение используется в программе или активном занятии. Сначала уберите связи или завершите занятие.');
  item.archived = archived;
}

export function saveTechnique(data, id, input, now) {
  const item = findItem(data, id);
  if (!item) return false;
  const technique = { setup: input.setup, movement: input.movement, attention: input.attention, mistakes: input.mistakes, source: input.source, model: input.model, updatedAt: now.toISOString() };
  try { validateItemFields({ ...item, technique }); } catch (e) { fail(e.message); }
  item.technique = technique;
}

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

export function groupDeleteError(data, groupId) {
  const group = findGroup(data, groupId);
  return group?.items.length ? 'Можно удалить только пустую группу. Перенесите упражнения в другую группу, включая архивные.' : null;
}

export function deleteGroup(data, groupId) {
  const error = groupDeleteError(data, groupId);
  if (error) fail(error);
  data.groups = data.groups.filter(g => g.id !== groupId);
}

// Legacy weight journal (records) from before workouts existed. Only corrections are allowed now:
// new sets are saved in workouts. input: raw form values {weight, reps, date, up}; reps may be a range like "8–10".
export function saveRecord(data, { group, id, recordId }, input) {
  const record = groupItem(data, group, id)?.records.find(r => r.id === recordId);
  if (!record) return false;
  const weight = Number(String(input.weight || '').replace(',', '.'));
  if (!input.weight || !Number.isFinite(weight) || weight <= 0) fail('Укажите положительный вес');
  const reps = String(input.reps || '').trim();
  Object.assign(record, { weight, reps: reps === '' ? null : reps, date: String(input.date || '') || null, up: !!input.up });
}

export function removeRecord(data, { group, id, recordId }) {
  const item = groupItem(data, group, id);
  if (!item?.records.some(r => r.id === recordId)) return false;
  item.records = item.records.filter(r => r.id !== recordId);
}
