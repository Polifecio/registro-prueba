importScripts('cola.js');

var CACHE = 'registro-prueba-v2';
var ARCHIVOS = ['./', 'index.html', 'cola.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  // cache:'reload' pide los archivos nuevos a internet, no la copia vieja del navegador.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(ARCHIVOS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Archivos de la app: primero la caché (funciona sin internet).
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || fetch(e.request); }));
});

// Android: Chrome despierta esto cuando vuelve la señal, aunque la app esté cerrada.
self.addEventListener('sync', function (e) {
  if (e.tag === 'subir') e.waitUntil(Cola.subir().then(avisar));
});

function avisar() {
  return self.clients.matchAll().then(function (cs) { cs.forEach(function (c) { c.postMessage('actualizar'); }); });
}
