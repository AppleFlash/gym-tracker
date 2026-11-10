// Persisted data shape: seed program, validation of stored/imported JSON and migrations of old formats.
import { uid, localDate } from './shared.js';
import { DAYS, variantsOf, findVariant } from './program.js';
import { catalogItems, muscleSpec, itemDefaults, validateItemFields } from './catalog.js';

const exercise = (id, name, sets, range, weightId = null) => ({ id, name, sets, range, weightId });
const rec = (weight, reps = null, date = null, up = false) => ({ id: uid(), weight, reps, date, up });

export const VERSION = 4;
const emptyProfile = () => ({ goal: '', context: '', facts: [], lastExportAt: null, weightNoticeSeen: false });

export function initialData() {
  return normalize(normalizeCatalog({version:2,tab:'workouts',workouts:[],drafts:{},profile:emptyProfile(),days:{A:[exercise('a1','Жим гантелей под углом',3,'6–8','incline'),exercise('a2','Жим стоя OHP',3,'6–8','ohp'),exercise('a3','Тяга верхнего блока / подтягивания',3,'8–12','lat'),exercise('a4','Махи в стороны',3,'12–15','laterals'),exercise('a5','Жим ногами',3,'8–10','legpress'),exercise('a6','Разгибания на трицепс',2,'10–12')],B:[exercise('b1','Подтягивания / верхний блок',3,'6–10','lat'),exercise('b2','Тяга в упоре (chest-supported)',3,'8–12'),exercise('b3','Румынская тяга',3,'8–10','rdl'),exercise('b4','Махи в стороны',3,'12–15','laterals'),exercise('b5','Face pull',3,'15–20'),exercise('b6','Сгибания на бицепс',3,'8–12')],C:[exercise('c1','Жим штанги лёжа',3,'6–8','bench'),exercise('c2','Жим гантелей под углом',3,'8–10','incline'),exercise('c3','Горизонтальная тяга',3,'8–12','row'),exercise('c4','Махи в стороны',3,'12–15','laterals'),exercise('c5','Разведение на заднюю дельту',3,'15–20','rear'),exercise('c6','Молотки',2,'10–12','hammer')],star:[]},groups:[{id:'shoulders',name:'Плечи',items:[{id:'ohp',name:'Передняя дельта · жим штанги вертикальный',records:[rec(25)]},{id:'seatedpress',name:'Передняя дельта · жим сидя',records:[rec(12),rec(24.5,10),rec(22.9,8)]},{id:'laterals',name:'Средняя дельта · махи гантелей',records:[rec(12,14),rec(14,12)]},{id:'rear',name:'Махи на заднюю дельту',records:[rec(12,14)]}]},{id:'legs',name:'Ноги',items:[{id:'legpress',name:'Жим ногами',records:[rec(80)]},{id:'rdl',name:'Румынская тяга',records:[rec(100,8)]}]},{id:'back',name:'Спина',items:[{id:'lat',name:'Тяга блока к груди',records:[rec(59)]},{id:'row',name:'Тяга блока горизонтальная',records:[rec(59,10),rec(66,10),rec(73,8)]}]},{id:'chest',name:'Грудь',items:[{id:'bench',name:'Жим штанги горизонтальный',records:[rec(60,2)]},{id:'machineflat',name:'Жим горизонтальный · свободный вес в тренажёре',records:[rec(69,'8–10'),rec(71.5,8)]},{id:'incline',name:'Жим на наклонной скамье',records:[rec(20,10),rec(22,8)]},{id:'seatedmachine',name:'Жим сидя в тренажёре',records:[rec(50,10,null,true),rec(59,8)]}]},{id:'biceps',name:'Бицепс',items:[{id:'hammer',name:'Молотки в кроссовере с верёвкой',records:[rec(20.3,14)]}]}]}));
}

const isTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const optionalTime = value => value == null || isTime(value);
const validSavedSet = set => set && typeof set.id === 'string' && Number.isFinite(set.weight) && set.weight >= 0 && Number.isInteger(set.reps) && set.reps > 0;
const isMap = value => !!value && typeof value === 'object' && !Array.isArray(value);

// Minimal shape check for a backup file before asking the user to replace their data.
export function assertBackupShape(data) {
  normalize(structuredClone(data));
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
    let item = catalogItems(data).find(i => i.id === exercise.weightId);
    if (!item) { item = { id: uid(), name: exercise.name, records: [] }; muscleGroup(exercise.name).items.push(item); }
    exercise.weightId = item.id;
    exercise.name = item.name;
  }
  return data;
}

// Version 1: per-day done marks and sessions, separate history snapshots.
function validateV1(data) {
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
}

// Version 1 → 2: history and per-day marks become workouts. Nothing is dropped: old marks without sets stay as
// legacyDone, unsaved rows become drafts, several unfinished days become several active workouts to resolve.
function migrateV1(data, now) {
  const link = (day, variantId) => findVariant(data, day, variantId)?.weightId ?? null; // by id only, never by name
  const sets = list => (list || []).map(s => ({ id: s.id, weight: s.weight, reps: s.reps }));
  const workouts = (data.history || []).map(h => ({
    id: h.id, day: h.day, status: 'completed', legacy: true, startedAt: h.completedAt, completedAt: h.completedAt, date: h.date,
    slots: h.exercises.map(e => {
      const performed = e.performed?.length ? e.performed : e.sets?.length ? [e] : [];
      const variants = [{ id: e.id, name: e.name, weightId: link(h.day, e.id) }, ...performed.filter(p => p.id !== e.id).map(p => ({ id: p.id, name: p.name, weightId: link(h.day, p.id) }))];
      const withSets = performed.filter(p => p.sets?.length);
      return {
        id: e.id, name: e.name, variants, selectedId: withSets.at(-1)?.id || e.id,
        status: withSets.length || e.completed ? 'done' : 'skipped', ...(e.completed && !withSets.length ? { legacyDone: true } : {}),
        performed: Object.fromEntries(withSets.map(p => [p.id, { sets: sets(p.sets) }])),
      };
    }),
  }));
  const drafts = {};
  for (const day of DAYS) {
    const done = data.done?.[day] || [], sessions = data.sessions?.[day] || {};
    if (!done.length && !Object.keys(sessions).length) continue;
    const started = Object.values(sessions).map(s => s.startedAt).sort()[0] || now.toISOString();
    const workout = { id: uid(), day, status: 'active', legacy: true, startedAt: started, completedAt: null, date: localDate(new Date(started)), slots: [] };
    for (const slot of data.days[day] || []) {
      const variants = variantsOf(slot), performed = {};
      for (const v of variants) {
        const session = sessions[v.id];
        if (session?.completedAt) performed[v.id] = { sets: sets(session.sets) };
        else if (session) {
          const rows = session.sets.filter(r => String(r.weight ?? '').trim() !== '' || String(r.reps ?? '').trim() !== '').map(r => ({ weight: String(r.weight ?? ''), reps: String(r.reps ?? '') }));
          if (rows.length) (drafts[workout.id] ||= {})[slot.id + ':' + v.id] = rows;
        }
      }
      const marked = variants.some(v => done.includes(v.id)), hasSets = Object.keys(performed).length > 0;
      workout.slots.push({
        id: slot.id, name: slot.name, variants: variants.map(v => ({ id: v.id, name: v.name, weightId: v.weightId ?? null, sets: v.sets, range: v.range })),
        selectedId: variants.some(v => v.id === slot.selectedId) ? slot.selectedId : slot.id,
        status: marked ? 'done' : 'pending', ...(marked && !hasSets ? { legacyDone: true } : {}), performed,
      });
    }
    workouts.push(workout);
  }
  for (const slot of Object.values(data.days).flat()) delete slot.selectedId;
  Object.assign(data, { version: 2, workouts, drafts, profile: { ...emptyProfile(), context: data.ai?.profile || '' } });
  for (const key of ['history', 'done', 'sessions', 'today', 'lastDay', 'ai']) delete data[key];
}

const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isText = value => typeof value === 'string' || typeof value === 'number';
const invalid = message => { throw Error(message); };

function validateV2(data) {
  for (const exercises of Object.values(data.days)) {
    if (!Array.isArray(exercises)) invalid('Неверный формат программы');
    for (const e of exercises) for (const v of variantsOf(e))
      if (!v || typeof v.id !== 'string' || typeof v.name !== 'string' || (v !== e && (!Number.isInteger(v.sets) || v.sets < 1 || typeof v.range !== 'string'))) invalid('Неверный формат упражнения программы');
  }
  if (!Array.isArray(data.workouts)) invalid('Неверный формат тренировок');
  const ids = new Set();
  for (const w of data.workouts) {
    if (!w || typeof w.id !== 'string' || ids.has(w.id) || !DAYS.includes(w.day) || !['active', 'completed'].includes(w.status) || !isTime(w.startedAt) || !isDate(w.date)
      || (w.status === 'completed' && !isTime(w.completedAt)) || !Array.isArray(w.slots)) invalid('Неверный формат тренировки');
    ids.add(w.id);
    const slotIds = new Set();
    for (const slot of w.slots) {
      if (slotIds.has(slot?.id)) invalid('Повторяющийся пункт тренировки');
      slotIds.add(slot?.id);
      if (!slot || typeof slot.id !== 'string' || typeof slot.name !== 'string' || !Array.isArray(slot.variants) || !slot.variants.length || !['pending', 'done', 'skipped'].includes(slot.status) || !isMap(slot.performed))
        invalid('Неверный формат упражнения тренировки');
      if (new Set(slot.variants.map(v => v?.id)).size !== slot.variants.length) invalid('Повторяющийся вариант упражнения');
      if (slot.variants.some(v => !v || typeof v.id !== 'string' || typeof v.name !== 'string' || (v.weightId !== null && typeof v.weightId !== 'string')) || !slot.variants.some(v => v.id === slot.selectedId))
        invalid('Неверный формат вариантов упражнения');
      for (const [variantId, p] of Object.entries(slot.performed))
        if (!slot.variants.some(v => v.id === variantId) || !Array.isArray(p?.sets) || p.sets.some(set => !validSavedSet(set))) invalid('Неверный формат подходов');
    }
  }
  if (!isMap(data.drafts)) invalid('Неверный формат черновиков');
  for (const [workoutId, rows] of Object.entries(data.drafts)) {
    const workout = data.workouts.find(w => w.id === workoutId);
    if (workout?.status !== 'active' || !isMap(rows)) invalid('Неверный формат черновиков');
    const keys = new Set(workout.slots.flatMap(s => s.variants.map(v => s.id + ':' + v.id)));
    if (Object.entries(rows).some(([key, list]) => !keys.has(key) || !Array.isArray(list) || list.some(r => !r || !isText(r.weight) || !isText(r.reps)))) invalid('Неверный формат черновиков');
  }
  const p = data.profile;
  if (!isMap(p) || typeof p.goal !== 'string' || typeof p.context !== 'string' || (p.lastExportAt !== null && !isTime(p.lastExportAt))) invalid('Неверный формат профиля');
}

const memoryText = (v, max = 1200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
function validateCoachMemory(data) {
  const unique = list => new Set(list.map(v => v?.id)).size === list.length;
  if (!Array.isArray(data.profile.facts) || !unique(data.profile.facts) || data.profile.facts.some(f => !f || !memoryText(f.id, 200) || !memoryText(f.text) || !isTime(f.createdAt))) invalid('Неверный формат фактов профиля');
  if (!Array.isArray(data.agreements) || !unique(data.agreements)) invalid('Неверный формат договорённостей');
  for (const a of data.agreements) {
    const scope = a?.scope, review = a?.review, baseline = a?.baseline;
    if (!a || !memoryText(a.id, 200) || !memoryText(a.text) || !isTime(a.acceptedAt) || !['active', 'done', 'cancelled'].includes(a.status)
      || (a.status === 'active' ? a.closedAt !== null : !isTime(a.closedAt))
      || !scope || !['program', 'day', 'exercise'].includes(scope.kind) || (scope.kind === 'day' && !DAYS.includes(scope.day))
      || (scope.kind === 'exercise' && !memoryText(scope.weightId, 200))
      || !review || !memoryText(review.text) || !(review.afterRuns === null || (scope.kind === 'exercise' && Number.isInteger(review.afterRuns) && review.afterRuns >= 1 && review.afterRuns <= 10))) invalid('Неверный формат договорённости');
    if (baseline !== null && (!baseline || scope.kind !== 'exercise' || baseline.weightId !== scope.weightId || !memoryText(baseline.workoutId, 200) || !isDate(baseline.date)
      || !Array.isArray(baseline.sets) || !baseline.sets.length || baseline.sets.some(s => !s || !Number.isFinite(s.weight) || s.weight < 0 || !Number.isInteger(s.reps) || s.reps < 1))) invalid('Неверный формат исходных показателей');
  }
}

// Screens that moved: the weights tab became "All exercises", "More" became the profile.
const MOVED_TABS = { weights: 'exercises', more: 'profile', data: 'settings', recommendations: 'settings' };

// Validates stored or imported data and upgrades older formats. Throws on invalid input.
export function normalize(data, now = new Date()) {
  if (!isMap(data?.days) || DAYS.some(day => !Array.isArray(data.days[day])) || !Array.isArray(data.groups)) throw Error('Неверный формат');
  if (data.version !== undefined && ![1, 2, 3, VERSION].includes(data.version)) throw Error('Неподдерживаемая версия данных');
  if (!data.version || data.version === 1) { validateV1(data); normalizeCatalog(data); migrateV1(data, now); }
  validateV2(data);
  if (data.version === 2) {
    normalizeCatalog(data);
    for (const item of catalogItems(data)) Object.assign(item, { ...itemDefaults(), ...item });
    data.version = 3;
  }
  if (data.version === 3) { data.profile.facts = []; data.agreements = []; data.version = VERSION; }
  validateCoachMemory(data);
  const groups = new Set(), ids = new Set();
  for (const group of data.groups) {
    if (!group || typeof group.id !== 'string' || groups.has(group.id) || typeof group.name !== 'string' || !Array.isArray(group.items)) invalid('Неверная группа');
    groups.add(group.id);
    for (const item of group.items) {
      if (!item || typeof item.id !== 'string' || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || !Array.isArray(item.records)) invalid('Неверное упражнение');
      ids.add(item.id); validateItemFields(item);
    }
  }
  for (const e of Object.values(data.days).flatMap(list => list.flatMap(variantsOf))) if (!ids.has(e.weightId)) invalid('Неизвестная ссылка программы на каталог');
  if (DAYS.includes(data.tab)) data.tab = 'workouts';
  data.tab = MOVED_TABS[data.tab] || data.tab;
  return data;
}
