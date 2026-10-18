/*
 * sw.js — offline support.
 *
 * The app is precached in full, PDF writer included, so a lesson plan can be
 * written and exported on a classroom network that has stopped working. The
 * cache name carries a version; bumping it retires the previous one on
 * activate.
 */

const VERSION = 'dlp-v3';
const ASSETS = [
  './',
  'index.html',
  'form.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/form.js',
  'js/schema.js',
  'js/storage.js',
  'js/share.js',
  'js/pwa.js',
  'js/pdf/writer.js',
  'js/pdf/layout.js',
  'js/pdf/afm.js',
  'js/pdf/encoding.js',
  'js/pdf/embed.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      /* Individually, so one missing asset cannot fail the whole install. */
      .then((cache) => Promise.all(ASSETS.map((url) =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => null))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== location.origin) return;

  /* Navigations: network first so an update lands promptly, cache as backup. */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  /* Everything else: cache first, since assets are versioned with the cache. */
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
