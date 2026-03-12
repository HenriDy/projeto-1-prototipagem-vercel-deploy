var CACHE_NAME = 'geoop-v2';
var URLS = ['/index.html'];
self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.addAll(URLS); }));
  self.skipWaiting();
});
self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(r) { return r || fetch(e.request); })
  );
});
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    })
  );
});
