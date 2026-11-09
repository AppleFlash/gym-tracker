// UI adapter wiring. main.js fills ctx; screens read state through it and call use cases.
export const ctx = { store: null, uc: null, render: () => {} };

// Screen-only state: never persisted.
export const view = {
  exerciseId: null,          // open exercise inside the current day tab
  modal: null,               // open sheet: {type: 'catalog'|'record'|'day', ...}
  sheetDepth: 0,             // catalog push depth, drives push/pop animation
  expanded: new Set(),       // `${day}:${slotId}` rows with alternatives shown
  openCharts: new Set(),     // weight journal cards with the chart open
  query: '',                 // weight journal search
  chat: [], chatBusy: false,
  progress: { A: 0, B: 0, C: 0, star: 0 }, // last drawn day progress, animates the bar
};

export const data = () => ctx.store.state;
export const route = () => ({ tab: data().tab, id: view.exerciseId });

// Reports a use case result to the user. True when the change was applied.
export function applied(result) {
  if (result?.error) { alert(result.error); return false; }
  return !!result?.ok;
}
