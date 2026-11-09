// Use cases: one entry point per user intention. Each runs domain rules on a draft through the store.
// Ports: store (state + persistence), clock, coach gateway { ask({system, messages}) }.
import * as program from '../domain/program.js';
import * as catalog from '../domain/catalog.js';
import * as session from '../domain/session.js';
import { finishWorkout } from '../domain/history.js';
import { assertBackupShape, normalize } from '../domain/schema.js';
import { coachPrompt } from './coach.js';

export function createUseCases({ store, clock = () => new Date(), coach }) {
  const run = change => store.update(change);
  return {
    // Program
    toggleDone: (day, id) => run(d => program.toggleDone(d, day, id)),
    selectVariant: (day, id, variantId) => run(d => program.selectVariant(d, day, id, variantId)),
    toggleToday: day => run(d => program.toggleToday(d, day)),
    addFromCatalog: (day, parentId, itemId) => run(d => program.addFromCatalog(d, day, parentId, catalog.findItem(d, itemId))),
    setExerciseParams: (day, id, params) => run(d => program.setExerciseParams(d, day, id, params)),
    moveExercise: (day, from, to) => run(d => program.moveExercise(d, day, from, to)),
    removeFromProgram: (day, id) => run(d => program.removeFromProgram(d, day, id)),
    resetDay: day => run(d => program.resetDay(d, day)),
    finishWorkout: day => run(d => finishWorkout(d, day, clock())),

    // Sets of the exercise being performed
    startExercise: (day, id) => run(d => session.startSession(d, day, id, clock())),
    addSet: (day, id) => run(d => session.addSet(d, day, id)),
    removeSet: (day, id, setId) => run(d => session.removeSet(d, day, id, setId)),
    saveExercise: (day, id) => run(d => session.completeSession(d, day, id, clock())),
    // Typing is saved in place: a draft keystroke must not be lost, and must not re-render the form.
    editSet(day, id, setId, field, value) {
      if (session.editSet(store.state, day, id, setId, field, value) !== false) store.persist();
    },

    // Catalog and weight journal
    addGroup: name => run(d => catalog.addGroup(d, name)),
    saveCatalogItem: (groupId, id, name) => run(d => catalog.saveItem(d, groupId, id, name)),
    deleteGroup: groupId => run(d => catalog.deleteGroup(d, groupId)),
    saveRecord: (ref, input) => run(d => catalog.saveRecord(d, ref, input)),
    removeRecord: ref => run(d => catalog.removeRecord(d, ref)),

    // Backup
    exportBackup: () => JSON.stringify(store.state, null, 2),
    // Throws on malformed input so the caller can report it before asking for confirmation.
    readBackup(text) { const data = JSON.parse(text); assertBackupShape(data); return data; },
    replaceData: data => store.commit(normalize(structuredClone(data))) ? { ok: true } : { error: 'Не удалось сохранить импорт.' },

    // Coach
    setProfile(text) { (store.state.ai ||= { profile: '' }).profile = text; store.persist(); },
    askCoach: messages => coach.ask({ system: coachPrompt(store.state, clock()), messages }),
  };
}
