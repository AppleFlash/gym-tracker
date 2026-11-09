// Persisted data shape: seed program, validation of stored/imported JSON and migrations of old formats.
import { uid } from './shared.js';
import { DAYS, variantsOf } from './program.js';
import { catalogItems, muscleSpec } from './catalog.js';

const exercise = (id, name, sets, range, weightId = null) => ({ id, name, sets, range, weightId });
const rec = (weight, reps = null, date = null, up = false) => ({ id: uid(), weight, reps, date, up });

export function initialData() {
  return normalizeCatalog({version:1,tab:'workouts',sessions:{},today:null,history:[],done:{A:[],B:[],C:[],star:[]},days:{A:[exercise('a1','Жим гантелей под углом',3,'6–8','incline'),exercise('a2','Жим стоя OHP',3,'6–8','ohp'),exercise('a3','Тяга верхнего блока / подтягивания',3,'8–12','lat'),exercise('a4','Махи в стороны',3,'12–15','laterals'),exercise('a5','Жим ногами',3,'8–10','legpress'),exercise('a6','Разгибания на трицепс',2,'10–12')],B:[exercise('b1','Подтягивания / верхний блок',3,'6–10','lat'),exercise('b2','Тяга в упоре (chest-supported)',3,'8–12'),exercise('b3','Румынская тяга',3,'8–10','rdl'),exercise('b4','Махи в стороны',3,'12–15','laterals'),exercise('b5','Face pull',3,'15–20'),exercise('b6','Сгибания на бицепс',3,'8–12')],C:[exercise('c1','Жим штанги лёжа',3,'6–8','bench'),exercise('c2','Жим гантелей под углом',3,'8–10','incline'),exercise('c3','Горизонтальная тяга',3,'8–12','row'),exercise('c4','Махи в стороны',3,'12–15','laterals'),exercise('c5','Разведение на заднюю дельту',3,'15–20','rear'),exercise('c6','Молотки',2,'10–12','hammer')],star:[]},groups:[{id:'shoulders',name:'Плечи',items:[{id:'ohp',name:'Передняя дельта · жим штанги вертикальный',records:[rec(25)]},{id:'seatedpress',name:'Передняя дельта · жим сидя',records:[rec(12),rec(24.5,10),rec(22.9,8)]},{id:'laterals',name:'Средняя дельта · махи гантелей',records:[rec(12,14),rec(14,12)]},{id:'rear',name:'Махи на заднюю дельту',records:[rec(12,14)]}]},{id:'legs',name:'Ноги',items:[{id:'legpress',name:'Жим ногами',records:[rec(80)]},{id:'rdl',name:'Румынская тяга',records:[rec(100,8)]}]},{id:'back',name:'Спина',items:[{id:'lat',name:'Тяга блока к груди',records:[rec(59)]},{id:'row',name:'Тяга блока горизонтальная',records:[rec(59,10),rec(66,10),rec(73,8)]}]},{id:'chest',name:'Грудь',items:[{id:'bench',name:'Жим штанги горизонтальный',records:[rec(60,2)]},{id:'machineflat',name:'Жим горизонтальный · свободный вес в тренажёре',records:[rec(69,'8–10'),rec(71.5,8)]},{id:'incline',name:'Жим на наклонной скамье',records:[rec(20,10),rec(22,8)]},{id:'seatedmachine',name:'Жим сидя в тренажёре',records:[rec(50,10,null,true),rec(59,8)]}]},{id:'biceps',name:'Бицепс',items:[{id:'hammer',name:'Молотки в кроссовере с верёвкой',records:[rec(20.3,14)]}]}]});
}

const isTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const optionalTime = value => value == null || isTime(value);
const validSavedSet = set => set && typeof set.id === 'string' && Number.isFinite(set.weight) && set.weight >= 0 && Number.isInteger(set.reps) && set.reps > 0;
const isMap = value => !!value && typeof value === 'object' && !Array.isArray(value);

// Minimal shape check for a backup file before asking the user to replace their data.
export function assertBackupShape(data) {
  if (!data?.days || !data.groups || !data.done || !Array.isArray(data.groups)) throw Error('Неверный формат');
}

function normalizeCatalog(data) {
  if (!Array.isArray(data.groups)) throw Error('Неверный формат базы упражнений');
  const ids = new Set();
  for (const group of data.groups) {
    if (!group || typeof group.id !== 'string' || typeof group.name !== 'string' || !Array.isArray(group.items)) throw Error('Неверный формат группы мышц');
    for (const item of group.items) {
      if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || !Array.isArray(item.records) || ids.has(item.id)) throw Error('Неверный формат упражнения в базе');
      ids.add(item.id);
    }
  }
  const muscleGroup = name => {
    const [id, title] = muscleSpec(name);
    let group = data.groups.find(g => g.name.toLowerCase() === title.toLowerCase() || g.id === id);
    if (!group) { group = { id: ids.has(id) ? uid() : id, name: title, items: [] }; data.groups.push(group); }
    return group;
  };
  // Migration: the legacy "workout-records" group is split into muscle groups.
  const legacyGroup = data.groups.find(g => g.id === 'workout-records');
  if (legacyGroup) {
    for (const item of legacyGroup.items) muscleGroup(item.name).items.push(item);
    data.groups = data.groups.filter(g => g !== legacyGroup);
  }
  // Migration: program entries without a weight journal get a catalog item.
  for (const entries of Object.values(data.days || {})) for (const exercise of entries.flatMap(variantsOf)) {
    let item = catalogItems(data).find(i => i.id === exercise.weightId)
      || catalogItems(data).find(i => i.name.trim().toLowerCase() === exercise.name.trim().toLowerCase());
    if (!item) { item = { id: uid(), name: exercise.name, records: [] }; muscleGroup(exercise.name).items.push(item); }
    exercise.weightId = item.id;
    exercise.name = item.name;
  }
  return data;
}

// Validates stored or imported data and upgrades older formats in place. Throws on invalid input.
export function normalize(data) {
  if (!data?.days || !data.groups) throw Error('Неверный формат');
  if (data.history === undefined) data.history = [];
  if (!Array.isArray(data.history) || data.history.some(h => !h || typeof h.id !== 'string' || !DAYS.includes(h.day) || !isTime(h.completedAt) || typeof h.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(h.date) || !Array.isArray(h.exercises) || !h.exercises.length || h.exercises.some(e => !e || typeof e.id !== 'string' || typeof e.name !== 'string' || typeof e.completed !== 'boolean')))
    throw Error('Неверный формат истории тренировок');
  for (const exercises of Object.values(data.days)) {
    if (!Array.isArray(exercises)) throw Error('Неверный формат программы');
    const ids = new Set();
    for (const exercise of exercises) {
      if (!exercise || exercise.alternatives !== undefined && !Array.isArray(exercise.alternatives)) throw Error('Неверный формат аналогичных упражнений');
      const variants = variantsOf(exercise);
      for (const variant of variants) {
        if (!variant || typeof variant.id !== 'string' || ids.has(variant.id) || typeof variant.name !== 'string') throw Error('Неверный формат аналогичных упражнений');
        if (variant !== exercise && (!Number.isInteger(variant.sets) || variant.sets < 1 || typeof variant.range !== 'string' || variant.alternatives !== undefined)) throw Error('Неверный формат аналогичного упражнения');
        ids.add(variant.id);
      }
      if (exercise.selectedId !== undefined && !variants.some(v => v.id === exercise.selectedId)) throw Error('Неизвестное выбранное упражнение');
    }
  }
  for (const workout of data.history) for (const exercise of workout.exercises) {
    if (exercise.sets !== undefined && (!Array.isArray(exercise.sets) || exercise.sets.some(set => !validSavedSet(set)))) throw Error('Неверный формат истории подходов');
    if (!optionalTime(exercise.startedAt) || !optionalTime(exercise.completedAt)) throw Error('Неверное время упражнения');
    if (exercise.performed !== undefined && (!Array.isArray(exercise.performed) || exercise.performed.some(e => !e || typeof e.id !== 'string' || typeof e.name !== 'string' || !Array.isArray(e.sets) || e.sets.some(set => !validSavedSet(set)) || !optionalTime(e.startedAt) || !optionalTime(e.completedAt))))
      throw Error('Неверный формат выполненных упражнений');
  }
  if (data.sessions === undefined) data.sessions = {};
  if (!isMap(data.sessions)) throw Error('Неверный формат подходов');
  for (const [day, entries] of Object.entries(data.sessions)) {
    if (!DAYS.includes(day) || !isMap(entries)) throw Error('Неверный формат подходов');
    for (const entry of Object.values(entries)) {
      if (!entry || !isTime(entry.startedAt) || !Array.isArray(entry.sets) || entry.sets.some(set => !set || typeof set.id !== 'string' || !['string', 'number'].includes(typeof set.weight) || !['string', 'number'].includes(typeof set.reps))
        || (entry.completedAt && (!isTime(entry.completedAt) || entry.sets.some(set => !validSavedSet(set))))
        || (entry.recordIds !== undefined && (!Array.isArray(entry.recordIds) || entry.recordIds.some(id => typeof id !== 'string'))))
        throw Error('Неверный формат подходов');
    }
  }
  // Migration: day tabs and the removed recommendations tab open the workouts list.
  if (DAYS.includes(data.tab)) data.tab = 'workouts';
  if (data.tab === 'recommendations') data.tab = 'data';
  return normalizeCatalog(data);
}
