// Online market data is never cached by this worker.
const CACHE = 'chart-replay-offline-v2';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
  self.skipWaiting?.();
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE)));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('chart-replay-offline-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients?.claim?.())
  );
});
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
});
