const CACHE = 'agiasos-v20';
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
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
  );
});

// Anything that talks to the database/auth must NEVER be cached.
// (This was the cause of the "one step behind" stale-data bug.)
function isLiveData(url) {
  return url.hostname.endsWith('supabase.co');
}

self.addEventListener('fetch', e => {
  let url;
  try { url = new URL(e.request.url); } catch (_) { return; }

  // 1) Live data (Supabase REST / Auth / Functions): network only, no cache, ever.
  if (isLiveData(url)) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 2) Non-GET: straight to network.
  if (e.request.method !== 'GET') {
    e.respondWith(fetch(e.request));
    return;
  }

  // 3) Navigation (opening the app): network first, cache as offline fallback.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(async networkRes => {
          if (networkRes.ok) {
            const cache = await caches.open(CACHE);
            cache.put(e.request, networkRes.clone());
          }
          return networkRes;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 4) Static assets (fonts, libraries, icons): cache first, network fallback.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
