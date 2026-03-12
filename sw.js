var CACHE = "geo-v10";
var ASSETS = ["/", "/index.html", "/database.js"];
self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});
self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }));
});
self.addEventListener("fetch", function(e) {
  if (e.request.url.includes("googleapis") || e.request.url.includes("gstatic") || e.request.url.includes("firebase")) return;
  e.respondWith(caches.match(e.request).then(function(r) { return r || fetch(e.request); }).catch(function() { return caches.match("/index.html"); }));
});
