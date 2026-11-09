// Composition root: the only place that knows every layer. Builds adapters, store and use cases, starts the UI.
import { createLocalStorageRepository } from './adapters/local-storage-repository.js';
import { createGeminiProxyGateway } from './adapters/gemini-proxy-gateway.js';
import { createStore } from './application/store.js';
import { createUseCases } from './application/use-cases.js';
import { ctx, view } from './ui/context.js';
import { render } from './ui/shell.js';
import { bindEvents } from './ui/events.js';
import { go } from './ui/router.js';
import { openCatalog } from './ui/sheets/catalog.js';
import { syncViewport, watchViewport, viewport } from './ui/viewport.js';
import { initialData, normalize } from './domain/schema.js';
import { findItem } from './domain/catalog.js';
import { coachPrompt } from './application/coach.js';

const STORAGE_KEY = 'gym-tracker-v1';
const AI_URL = 'https://gym-ai-proxy-personal-7cd3.vercel.app/api/chat';

const status = document.getElementById('saveStatus');
const repository = createLocalStorageRepository(STORAGE_KEY, text => { status.textContent = text; });
const store = createStore(repository);
Object.assign(ctx, { store, uc: createUseCases({ store, coach: createGeminiProxyGateway(AI_URL) }), render });

bindEvents();
watchViewport();
syncViewport();
render();
// Never overwrite unreadable data silently: it was archived, and the user is told where.
if (store.loadError) alert(`Не удалось прочитать сохранённые данные (${store.loadError.message}). Копия сохранена в браузере под ключом «${store.loadError.copy}». Приложение открыто с начальными данными.`);
store.persist();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(err => console.warn('Offline cache unavailable:', err)));
}

// Debug and regression-test handle (tests/*.js run in the page console). Not used by the app itself.
window.gym = {
  KEY: STORAGE_KEY,
  get state() { return store.state; }, set state(next) { store.state = next; },
  get exerciseId() { return view.exerciseId; }, set exerciseId(id) { view.exerciseId = id; },
  get modal() { return view.modal; }, set modal(m) { view.modal = m; },
  get vvMax() { return viewport.max; }, set vvMax(v) { viewport.max = v; },
  view, store, uc: ctx.uc,
  initial: initialData,
  normalize,
  render,
  update: () => { store.persist(); render(); },
  onVV: syncViewport,
  go,
  openCatalog,
  findExercise: id => findItem(store.state, id),
  aiContext: (context = null) => coachPrompt(store.state, new Date(), context),
};
