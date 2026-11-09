// Workout history: finishing a day snapshots its slots, performed variants and sets.
import { uid, localDate } from './shared.js';
import { variantsOf, isDone } from './program.js';
import { sessionFor } from './session.js';

function snapshotExercise(data, day, exercise) {
  const done = data.done[day] || [], alternativeDone = (exercise.alternatives || []).some(e => done.includes(e.id));
  const performed = variantsOf(exercise)
    .filter(e => sessionFor(data, day, e.id)?.completedAt || done.includes(e.id) && (e.id !== exercise.id || !alternativeDone))
    .map(e => {
      const session = sessionFor(data, day, e.id);
      return { id: e.id, name: e.name, startedAt: session?.startedAt || null, completedAt: session?.completedAt || null, sets: session?.completedAt ? session.sets.map(set => ({ ...set })) : [] };
    });
  const latest = performed.filter(e => e.completedAt).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  return { id: exercise.id, name: exercise.name, completed: isDone(data, day, exercise.id), startedAt: latest?.startedAt || null, completedAt: latest?.completedAt || null, sets: latest?.sets || [], performed };
}

// Saves the day into history and clears its marks and sessions.
export function finishWorkout(data, day, now) {
  const exercises = data.days[day];
  if (!exercises?.length) return false;
  data.history.push({ id: uid(), day, completedAt: now.toISOString(), date: localDate(now), exercises: exercises.map(e => snapshotExercise(data, day, e)) });
  data.sessions = { ...data.sessions, [day]: {} };
  data.done[day] = [];
  if (data.today === day) data.today = null;
  data.lastDay = day;
}

export const historyNewestFirst = data => [...data.history].sort((a, b) => b.date.localeCompare(a.date) || b.completedAt.localeCompare(a.completedAt));
