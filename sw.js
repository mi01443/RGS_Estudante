// RGS Estudante — Service Worker
const CACHE = 'rgs-v1';
const FILES = [
  '/RGS_Estudante/',
  '/RGS_Estudante/index.html',
  '/RGS_Estudante/app.css',
  '/RGS_Estudante/app.js',
  '/RGS_Estudante/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Sempre busca da rede primeiro, cache como fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
