/* Путь Дракона — офлайн-кэш. Стратегия: ядро курса кэшируется при установке,
   данные о чертах иероглифов и шрифты — по мере обращения. Версию менять при обновлении курса. */
const V = 'dp-v1';
const CORE = ['./','./index.html','./app.js','./manifest.webmanifest','./icon.svg','./lib/hanzi-writer.min.js',
  './data/core.js','./data/words.js','./data/words2.js','./data/words3.js','./data/lessons-g1.js','./data/lessons-g2.js','./data/lessons-g3.js',
  './data/lessons-g4.js','./data/lessons-g5.js','./data/lessons-g6.js','./data/lessons-g7.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.includes('/api/')) return;
  // ядро: сеть в приоритете (чтобы обновления доходили), офлайн — из кэша
  const isCore = u.origin === location.origin && !u.pathname.includes('/data/hanzi/');
  if (isCore) {
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
  } else {
    // черты иероглифов, шрифты, CDN: кэш в приоритете
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return res; })));
  }
});
