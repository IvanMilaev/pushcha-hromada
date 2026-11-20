/* Pushcha hromada prototype — service worker.
   Pages and assets: cache-first. data/*.json: network-first (4 s), then the saved copy.
   Bump CACHE_VERSION whenever a page, style.css or app.js changes. */
'use strict';

var CACHE_VERSION = 'ph-v51';
var PRECACHE = [
  './',
  'index.html',
  'status.html',
  'news.html',
  'events.html',
  'help.html',
  'more.html',
  'add.html',
  'emergencies.html',
  'about.html',
  'map.html',
  'assets/map.js',
  'assets/map.svg',
  'assets/style.css',
  'assets/fonts/rubik-cyrillic.woff2',
  'assets/fonts/rubik-latin.woff2',
  'assets/app.js',
  'assets/home.js',
  'assets/icons.svg',
  'icon.svg',
  'manifest.webmanifest',
  'data/status.json',
  'data/help.json',
  'data/events.json',
  'data/posts.json',
  'data/orgs.json',
  'data/places.json',
  'data/photos.json'      // the list only; each photo is kept after its first view (shellRequest, /img/)
];
var NETWORK_TIMEOUT = 4000;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // cache: 'reload' — take every file fresh from the server, never the browser's own (possibly old) copy,
      // or a new version could be saved with an old map.js or style.css inside
      .then(function (cache) { return cache.addAll(PRECACHE.map(function (u) { return new Request(u, { cache: 'reload' }); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function markCached(response) {
  // Re-wrap the saved copy so the page can tell it is old data.
  return response.blob().then(function (body) {
    var headers = new Headers(response.headers);
    headers.set('X-PH-From-Cache', '1');
    return new Response(body, { status: response.status, statusText: response.statusText, headers: headers });
  });
}

function dataRequest(request) {
  var key = request.url.split('?')[0];
  var network = new Promise(function (resolve, reject) {
    var timer = setTimeout(function () { reject(new Error('timeout')); }, NETWORK_TIMEOUT);
    fetch(request).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) { reject(new Error('HTTP ' + res.status)); return; }
      var copy = res.clone();
      caches.open(CACHE_VERSION).then(function (cache) { cache.put(key, copy); });
      resolve(res);
    }, function (err) { clearTimeout(timer); reject(err); });
  });
  return network.catch(function () {
    return caches.match(key).then(function (cached) {
      if (cached) return markCached(cached);
      return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
    });
  });
}

function shellRequest(request) {
  return caches.match(request, { ignoreSearch: true }).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (res) {
      // News pictures are not precached: keep each one after its first view, so it shows offline too.
      if (res.ok && new URL(request.url).pathname.indexOf('/img/') !== -1) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(request, copy); });
      }
      return res;
    }).catch(function () {
      if (request.mode === 'navigate') return caches.match('index.html');
      return Response.error();
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch other sites
  if (url.pathname.indexOf('/data/') !== -1) {
    event.respondWith(dataRequest(request));
  } else {
    event.respondWith(shellRequest(request));
  }
});
