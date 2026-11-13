// UI adapter wiring. main.js fills ctx; screens read state through it and call use cases.
export const ctx = { store: null, uc: null, apiKey: null, render: () => {} };

// Screen-only state: never persisted (drafts themselves are persisted by the use cases).
export const view = {
  exerciseId: null,          // route id: slot in a day, workout for 'result', catalog item for 'item'
  modal: null,               // open sheet: {type: 'catalog'|'variants'|'record'|'day'|'set', ...}
  sheetDepth: 0,             // catalog push depth, drives push/pop animation
  catalog: { query: '', mode: 'all', group: '', equipment: '' }, // Shared catalog filters
  historyPeriod: 'Y',
  exerciseTab: 'sets',       // segment of the exercise screen: 'sets' | 'analytics' | 'history'
  resultFrom: 'profile',     // where a workout result was opened from: 'workouts' after finishing, else history
  itemParent: 'exercises',   // 'progress' or 'exercises'
  chat: [], chatBusy: false,
  chatContext: null,         // {kind: 'workout', id, label} | {kind: 'exercise', weightId, label}
  chatPrefill: '',
  keyEditing: false,         // settings: API key field is open for input
};

export const data = () => ctx.store.state;
export const route = () => ({ tab: data().tab, id: view.exerciseId });

// Reports a use case result to the user. True when the change was applied.
export function applied(result) {
  if (result?.error) { alert(result.error); return false; }
  return !!result?.ok;
}

// Re-renders and keeps the reading position (saving a set must not jump the list).
export function rerender() {
  const app = document.getElementById('app'), top = app.scrollTop;
  ctx.render();
  app.scrollTop = top;
}
