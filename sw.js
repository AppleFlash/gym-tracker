const CACHE_NAME = 'gym-tracker-pwa-v72';
const SHELL = ['./', './index.html', './app.css', './design-system.css', './design-system.js', './src/adapters/deepseek-proxy-gateway.js', './src/adapters/local-storage-repository.js', './src/application/catalog-ai.js', './src/application/coach.js', './src/application/evidence.js', './src/application/store.js', './src/application/use-cases.js', './src/domain/catalog.js', './src/domain/program.js', './src/domain/schema.js', './src/domain/shared.js', './src/domain/workout.js', './src/main.js', './src/ui/catalog-list.js', './src/ui/context.js', './src/ui/events.js', './src/ui/format.js', './src/ui/history-chart-data.js', './src/ui/reorder.js', './src/ui/router.js', './src/ui/screens/chat.js', './src/ui/screens/exercise.js', './src/ui/screens/history.js', './src/ui/screens/home.js', './src/ui/screens/profile.js', './src/ui/screens/result.js', './src/ui/screens/workout.js', './src/ui/sets.js', './src/ui/sheets/catalog-ai.js', './src/ui/sheets/catalog.js', './src/ui/sheets/edit.js', './src/ui/sheets/variants.js', './src/ui/shell.js', './src/ui/viewport.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) { const copy=response.clone(); caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy)); }
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

