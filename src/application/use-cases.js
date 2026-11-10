// Use cases: one entry point per user intention. Each runs domain rules on a draft through the store.
// Ports: store (state + persistence), clock, coach gateway { ask({system, messages}) }.
import * as program from '../domain/program.js';
import * as catalog from '../domain/catalog.js';
import * as workouts from '../domain/workout.js';
import { assertBackupShape, normalize } from '../domain/schema.js';
import { coachPrompt, RESPONSE_RULES, parseCoachReply, validateProposals } from './coach.js';
import { fail, uid } from '../domain/shared.js';
import { requestAlternatives, requestTechnique, validateSuggestions } from './catalog-ai.js';

export function createUseCases({ store, clock = () => new Date(), coach }) {
  const run = change => store.update(change);
  const attach = (d, day, parentId, itemId) => {
    const item = catalog.findItem(d, itemId), slot = parentId ? program.slotOf(d, day, parentId) : null;
    if (!program.DAYS.includes(day) || (parentId && !slot) || !item || item.archived) fail('Место добавления или упражнение больше не доступны.');
    const existing = slot && program.variantsOf(slot).find(v => v.weightId === itemId);
    const added = existing ? { slot, entryId: existing.id, alternative: true } : program.addFromCatalog(d, day, parentId, item);
    if (!added) return false;
    const workout = workouts.addToActive(d, day, added.slot, added.alternative ? added.entryId : null);
    if (workout && added.alternative) workouts.selectVariant(d, workout.id, added.slot.id, added.entryId);
    return added;
  };
  // In-place edits that must not re-render the form (typing); saved right away.
  const inPlace = change => { if (change(store.state) !== false) store.persist(); };
  return {
    // Templates. Additions and removals follow into the active workout of that day.
    addFromCatalog: (day, parentId, itemId) => run(d => {
      return attach(d, day, parentId, itemId);
    }),
    setExerciseParams: (day, id, params) => run(d => program.setExerciseParams(d, day, id, params)),
    moveExercise: (day, from, to) => run(d => program.moveExercise(d, day, from, to)),
    removeFromProgram: (day, id) => run(d => {
      const removed = program.removeFromProgram(d, day, id);
      if (removed) workouts.removeFromActive(d, day, removed.slotId, id);
      return removed;
    }),

    // Workouts
    startWorkout: day => run(d => workouts.startWorkout(d, day, clock())),
    finishWorkout: id => run(d => workouts.finishWorkout(d, id, clock())),
    deleteWorkout: id => run(d => workouts.deleteWorkout(d, id)),
    selectVariant: (id, slotId, variantId) => run(d => workouts.selectVariant(d, id, slotId, variantId)),
    completeSlot: (id, slotId) => run(d => workouts.completeSlot(d, id, slotId)),
    toggleSkip: (id, slotId) => run(d => workouts.toggleSkip(d, id, slotId)),
    openDraft: (id, slotId, variantId) => run(d => workouts.openDraft(d, id, slotId, variantId)),
    editDraft: (id, slotId, variantId, field, value) => inPlace(d => workouts.editDraft(d, id, slotId, variantId, field, value)),
    cancelDraft: (id, slotId, variantId) => run(d => workouts.cancelDraft(d, id, slotId, variantId)),
    saveSet: (id, slotId, variantId, input) => run(d => workouts.saveSet(d, id, slotId, variantId, input)),
    updateSet: (id, slotId, variantId, setId, input) => run(d => workouts.updateSet(d, id, slotId, variantId, setId, input)),
    removeSet: (id, slotId, variantId, setId) => run(d => workouts.removeSet(d, id, slotId, variantId, setId)),

    // Catalog and the legacy weight journal
    addGroup: name => run(d => catalog.addGroup(d, name)),
    saveCatalogProperties: (id, input, target = null) => run(d => {
      const itemId = catalog.saveProperties(d, id, input);
      if (!id && target?.day) return { itemId, added: attach(d, target.day, target.parentId, itemId) };
      return { itemId };
    }),
    toggleFavorite: id => run(d => { const item = catalog.findItem(d, id); if (!item) return false; item.favorite = !item.favorite; }),
    archiveItem: (id, archived) => run(d => catalog.archiveItem(d, id, archived)),
    saveTechnique: (id, input) => run(d => catalog.saveTechnique(d, id, input, clock())),
    suggestAlternatives: (day, slotId, input) => requestAlternatives(coach, structuredClone(store.state), day, slotId, input),
    generateTechnique: (id, input) => {
      const item = catalog.findItem(store.state, id), group = catalog.itemGroup(store.state, id);
      if (!item || !group) fail('Упражнение больше не доступно.');
      return requestTechnique(coach, structuredClone(item), group, input);
    },
    acceptAlternative: (day, slotId, input, suggestion, properties = null) => run(d => {
      const slot = program.slotOf(d, day, slotId);
      if (suggestion.kind === 'existing' && slot && program.variantsOf(slot).some(v => v.weightId === suggestion.itemId)) return attach(d, day, slotId, suggestion.itemId);
      const checked = validateSuggestions(d, day, slotId, input, { suggestions: [suggestion] })[0];
      if (checked.kind === 'new' && catalog.catalogItems(d).some(i => [i.name, ...i.aliases].some(n => catalog.searchKey(n) === catalog.searchKey(checked.name)))) fail('Такое название или синоним уже есть. Выберите существующее упражнение.');
      const id = checked.kind === 'existing' ? checked.itemId : catalog.saveProperties(d, null, properties || { ...checked, aliases: [], note: '' });
      return attach(d, day, slotId, id);
    }),
    deleteGroup: groupId => run(d => catalog.deleteGroup(d, groupId)),
    saveRecord: (ref, input) => run(d => catalog.saveRecord(d, ref, input)),
    removeRecord: ref => run(d => catalog.removeRecord(d, ref)),

    // Profile
    setProfileText: (field, text) => run(d => { if (!['goal', 'context'].includes(field)) return false; d.profile[field] = text; }),
    dismissWeightNotice: () => run(d => { d.profile.weightNoticeSeen = true; }),

    editFact: (id, text) => run(d => {
      const fact = d.profile.facts.find(f => f.id === id);
      if (!fact || typeof text !== 'string' || !text.trim() || text.length > 1200) fail('Введите факт длиной до 1200 символов.');
      fact.text = text.trim();
    }),
    removeFact: id => run(d => { const i = d.profile.facts.findIndex(f => f.id === id); if (i < 0) return false; d.profile.facts.splice(i, 1); }),
    acceptProposal: proposal => run(d => {
      const p = validateProposals(d, [proposal])[0];
      if (!p) fail('Предложение больше не доступно. Повторите обсуждение.');
      const now = clock().toISOString(), id = uid();
      if (p.type === 'profile') d.profile.facts.push({ id, text: p.text, createdAt: now });
      else {
        const source = p.baselineWorkoutId && workouts.performancesOf(d, p.scope.weightId).find(r => r.workout.id === p.baselineWorkoutId);
        const baseline = source ? { workoutId: source.workout.id, date: source.workout.date, weightId: p.scope.weightId, sets: source.sets.map(({ weight, reps }) => ({ weight, reps })) } : null;
        if (p.replaces) Object.assign(d.agreements.find(a => a.id === p.replaces), { status: 'cancelled', closedAt: now });
        d.agreements.push({ id, text: p.text, scope: p.scope, acceptedAt: now, baseline, review: p.review, status: 'active', closedAt: null });
      }
      return id;
    }),
    closeAgreement: (id, status) => run(d => {
      const agreement = d.agreements.find(a => a.id === id && a.status === 'active');
      if (!agreement || !['done', 'cancelled'].includes(status)) fail('Договорённость больше не активна.');
      Object.assign(agreement, { status, closedAt: clock().toISOString() });
    }),

    // Backup
    exportBackup() {
      const result = run(d => { d.profile.lastExportAt = clock().toISOString(); });
      return result?.ok ? JSON.stringify(store.state, null, 2) : null;
    },
    // Throws on malformed input so the caller can report it before asking for confirmation.
    readBackup(text) { const data = JSON.parse(text); assertBackupShape(data); return normalize(structuredClone(data), clock()); },
    replaceData: data => store.commit(data) ? { ok: true } : { error: 'Не удалось сохранить импорт. Освободите место и попробуйте снова.' },

    // Coach: context = null | {kind: 'workout', id} | {kind: 'exercise', weightId}
    askCoach: async (messages, context = null) => {
      const reply = await coach.ask({ system: coachPrompt(store.state, clock(), context) + RESPONSE_RULES, messages: messages.map(({ role, text }) => ({ role, text })), json: true });
      return parseCoachReply(store.state, reply);
    },
  };
}
