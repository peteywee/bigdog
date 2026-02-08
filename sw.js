/**
 * Big Dog PWA Service Worker (GitHub Pages friendly)
 * - Offline-first for core app shell
 * - Network-first for HTML (so updates ship fast)
 * - Cache-first for same-origin assets
 */
const VERSION = '2026-02-08.1';
const CACHE = `bigdog-${VERSION}`;

const CORE = [
  '/',
  '/index.html',
  '/manifest.json'
];

const OPTIONAL = [
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    await Promise.allSettled(OPTIONAL.map((u) => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

function isHTML(req) {
  if (req.mode === 'navigate') return true;
  const accept = (req.headers.get('accept') || '').toLowerCase();
  return req.method === 'GET' && accept.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isHTML(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(CACHE);
        cache.put('/index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cached = await caches.match('/index.html');
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Cache-first for static assets
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone()).catch(() => {});
      return fresh;
    } catch {
      return new Response('', { status: 504 });
    }
  })());
});
