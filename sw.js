// Service Worker for offline support and asset caching
// Minimal implementation to satisfy PWA install criteria
// Note: Keep lightweight; extend later with real caching

// Bump this when releasing a new version to ensure fresh cache
const CACHE_NAME = 'tiddeligames-shell-v0.0.2';
const APP_SHELL = [
  './',
  './index.html',
  './css/tailwind.output.css',
  './css/styles.css',
  './css/animations.css',
  './js/config.js',
  './js/app.js',
  './js/game-selector.js',
  './js/pwa.js',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
      // Notify clients that a new SW is active
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clientList.forEach((client) => client.postMessage({ type: 'SW_ACTIVATED' }));
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // only cache GET

  // Map /favicon.ico to an existing PNG icon to avoid 404s during development
  if (new URL(request.url).pathname.endsWith('/favicon.ico')) {
    event.respondWith(
      (async () => {
        const iconUrl = './assets/icons/icon-192.png';
        const cachedIcon = await caches.match(iconUrl);
        if (cachedIcon) return cachedIcon;
        try {
          const resp = await fetch(iconUrl);
          const cache = await caches.open(CACHE_NAME);
          cache.put(iconUrl, resp.clone());
          return resp;
        } catch (e) {
          return new Response('', { status: 204 });
        }
      })()
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});

// Allow page to request immediate activation of the waiting SW
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

