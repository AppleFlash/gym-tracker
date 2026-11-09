// Use cases: one entry point per user intention. Each runs domain rules on a draft through the store.
// Ports: store (state + persistence), clock, coach gateway { ask({system, messages}) }.
import * as program from '../domain/program.js';
import * as catalog from '../domain/catalog.js';
import * as workouts from '../domain/workout.js';
import { assertBackupShape, normalize } from '../domain/schema.js';
import { coachPrompt } from './coach.js';

export function createUseCases({ store, clock = () => new Date(), coach }) {
  const run = change => store.update(change);
  // In-place edits that must not re-render the form (typing); saved right away.
  const inPlace = change => { if (change(store.state) !== false) store.persist(); };
  return {
    // Templates. Additions and removals follow into the active workout of that day.
    addFromCatalog: (day, parentId, itemId) => run(d => {
      const added = program.addFromCatalog(d, day, parentId, catalog.findItem(d, itemId));
      if (!added) return false;
      const workout = workouts.addToActive(d, day, added.slot, added.alternative ? added.entryId : null);
      // A new alternative picked during a workout is used right away.
      if (workout && added.alternative) workouts.selectVariant(d, workout.id, added.slot.id, added.entryId);
      return added;
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
    saveCatalogItem: (groupId, id, name) => run(d => catalog.saveItem(d, groupId, id, name)),
    deleteGroup: groupId => run(d => catalog.deleteGroup(d, groupId)),
    saveRecord: (ref, input) => run(d => catalog.saveRecord(d, ref, input)),
    removeRecord: ref => run(d => catalog.removeRecord(d, ref)),

    // Profile
    setProfileText: (field, text) => inPlace(d => { if (!['goal', 'context'].includes(field)) return false; d.profile[field] = text; }),
    dismissWeightNotice: () => run(d => { d.profile.weightNoticeSeen = true; }),

    // Backup
    exportBackup() {
      const result = run(d => { d.profile.lastExportAt = clock().toISOString(); });
      return result?.ok ? JSON.stringify(store.state, null, 2) : null;
    },
    // Throws on malformed input so the caller can report it before asking for confirmation.
    readBackup(text) { const data = JSON.parse(text); assertBackupShape(data); return normalize(structuredClone(data), clock()); },
    replaceData: data => store.commit(data) ? { ok: true } : { error: 'Не удалось сохранить импорт. Освободите место и попробуйте снова.' },

    // Coach: context = null | {kind: 'workout', id} | {kind: 'exercise', weightId}
    askCoach: (messages, context = null) => coach.ask({ system: coachPrompt(store.state, clock(), context), messages }),
  };
}
