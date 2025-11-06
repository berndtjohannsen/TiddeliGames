// Service Worker for offline support and asset caching
// Minimal implementation to satisfy PWA install criteria
// Note: Keep lightweight; extend later with real caching

// Bump this when releasing a new version to ensure fresh cache
const CACHE_NAME = 'tiddeligames-shell-v1.0.0';
const APP_SHELL = [
  './',
  // NOTE: Do NOT pre-cache index.html to prevent stale app shell
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
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // only cache GET

  const url = new URL(request.url);

  // Network-first for navigation/HTML requests to always get latest app shell
  const isNavigation = request.mode === 'navigate' ||
    (request.destination === 'document') ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request, { cache: 'no-store' });
          return response;
        } catch (_) {
          // Fallback to cache if offline and we previously cached index.html (optional)
          const cached = await caches.match('./index.html');
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Never cache js/config.js - always fetch fresh for version checks
  if (url.pathname.includes('/js/config.js')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
    );
    return;
  }

  // Map /favicon.ico to an existing PNG icon to avoid 404s
  if (url.pathname.endsWith('/favicon.ico')) {
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

  // Cache-first for other GET requests (CSS/JS/images), fallback to network
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const resp = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, resp.clone());
        return resp;
      } catch (_) {
        return new Response('', { status: 504 });
      }
    })()
  );
});

// Allow page to request immediate activation of the waiting SW
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

