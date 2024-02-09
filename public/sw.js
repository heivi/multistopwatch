// Version 0.2
// Files to cache
const cacheName = 'multistop-v0.2';
const appShellFiles = [
  '/',
  '/app.js',
  '/autocomplete.min.js',
  '/favicon.ico',
  '/index.html',
  '/stopwatch.css',
  '/fontawesome/free/css/solid.css',
  '/fontawesome/free/css/fontawesome.css',
  '/fontawesome/free/webfonts/fa-solid-900.ttf',
  '/fontawesome/free/webfonts/fa-solid-900.woff2',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://code.jquery.com/jquery-3.7.1.slim.min.js',
  'https://cdn.socket.io/4.7.4/socket.io.min.js',
  'https://cdn.jsdelivr.net/npm/timesync',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
];

// Installing Service Worker
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
  e.waitUntil((async () => {
    const cache = await caches.open(cacheName);

    const cacheBypassRequests = appShellFiles.map(
      (url) => new Request(url, {cache: 'reload'}));

    for (let i of cacheBypassRequests) {
      try {
        ok = await cache.add(i);
      } catch (err) {
        console.log('sw: cache.add', i, err);
      }
    }

  })());
});

// Fetching content using Service Worker
self.addEventListener('fetch', (e) => {
  // Cache http and https only, skip unsupported chrome-extension:// and file://...
  if (e.request.method !== "GET" || !(
    e.request.url.startsWith('http:') || e.request.url.startsWith('https:')
  ) || e.request.url.includes("timesync") || e.request.url.includes("socket.io")
  || e.request.url.includes("manifest")) {
    return;
  }

  e.respondWith((async () => {
    const r = await caches.match(e.request);
    console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
    if (r) return r;
    const response = await fetch(e.request);
    const cache = await caches.open(cacheName);
    console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
    cache.put(e.request, response.clone());
    return response;
  })());
});
