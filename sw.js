const CACHE = 'agiasos-v19';
const ASSETS = ['./index.html', './manifest.json'];
const CDN = [
  'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      cache.addAll(ASSETS);
      CDN.forEach(url => cache.add(url).catch(() => {}));
    })
  );
  self.skipWaiting(); // activate immediately
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // take control immediately
});

self.addEventListener('fetch', e => {
  // For navigation requests (opening the app): always try network first
  // If network succeeds AND response differs from cache → tell page to reload
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(async networkRes => {
          if (networkRes.ok) {
            // Update cache with fresh version
            const cache = await caches.open(CACHE);
            cache.put(e.request, networkRes.clone());
          }
          return networkRes;
        })
        .catch(() => caches.match(e.request)) // offline fallback
    );
    return;
  }

  // For other assets: cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

// Notify all open pages to reload when a new SW activates
self.addEventListener('activate', () => {
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
  });
});
