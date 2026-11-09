const CACHE_NAME = 'gym-tracker-pwa-v36';
const SHELL = ['./', './index.html', './app.css', './design-system.css', './design-system.js', './src/adapters/gemini-proxy-gateway.js', './src/adapters/local-storage-repository.js', './src/application/coach.js', './src/application/store.js', './src/application/use-cases.js', './src/domain/catalog.js', './src/domain/history.js', './src/domain/program.js', './src/domain/schema.js', './src/domain/session.js', './src/domain/shared.js', './src/main.js', './src/ui/context.js', './src/ui/events.js', './src/ui/format.js', './src/ui/reorder.js', './src/ui/router.js', './src/ui/screens/chat.js', './src/ui/screens/exercise.js', './src/ui/screens/more.js', './src/ui/screens/weights.js', './src/ui/screens/workouts.js', './src/ui/sheets/catalog.js', './src/ui/sheets/edit.js', './src/ui/shell.js', './src/ui/viewport.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
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

