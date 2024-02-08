// Files to cache
const cacheName = 'multistop-v0.1';
const appShellFiles = [
  '/',
  '/app.js',
  '/index.html',
  '/stopwatch.css',
  '/fontawesome/free/css/solid.css',
  '/fontawesome/free/css/fontawesome.css',
  '/fontawesome/free/webfonts/fa-solid-900.ttf',
  '/fontawesome/free/webfonts/fa-solid-900.woff2',
  'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css',
  'https://code.jquery.com/jquery-3.7.1.slim.min.js',
  'https://cdn.socket.io/4.7.4/socket.io.min.js',
  'https://cdn.jsdelivr.net/npm/timesync',
  'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js',
];

// Installing Service Worker
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
  e.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    /*
      .then(function (cache) {
        console.log('[Service Worker] Caching all: app shell and content');
        // Magic is here. Look the  mode: 'no-cors' part.

        

        cache.addAll(appShellFiles.map(function (urlToPrefetch) {
          console.log(urlToPrefetch);
          return new Request(urlToPrefetch, { mode: 'no-cors' });
        })).then(function () {
          console.log('All resources have been fetched and cached.');
        });
      })

      */

    for (let i of appShellFiles) {
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
  ) || e.request.url.includes("timesync")) {
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
