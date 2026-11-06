// Olumi: guarda la app en el equipo para que abra aunque no haya señal. Siempre intenta la red primero.
const CACHE = 'olumi-beta-v31';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'vendor/supabase.js', 'icono-192.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(fetch(r).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
