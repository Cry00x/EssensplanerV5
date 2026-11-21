/* Service Worker: App-Shell vorab cachen (Offline-Start), danach „Cache zuerst, im Hintergrund aktualisieren“. */
const VERSION = 'essensplaner-v3';
const IMG_CACHE = 'essensplaner-img-v1';
const SDK_CACHE = 'essensplaner-sdk-v1'; // Firebase-Bibliothek (fest versioniert): einmal geladen, danach auch offline vorhanden
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css',
  './js/data.js', './js/data-ext.js', './js/engine.js', './js/store.js', './js/sync.js', './js/images.js', './js/importer.js', './js/familyfb.js', './js/firebase-config.js', './js/app.js', './js/features.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== IMG_CACHE && k !== SDK_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.open(SDK_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  // Rezeptfotos (nur Bilddateien frei lizenzierter Quellen): einmal geladen, auch offline verfügbar
  if (/^(upload\.wikimedia\.org|images\.pexels\.com)$/.test(url.hostname) && req.destination === 'image') {
    e.respondWith(caches.open(IMG_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit))));
    return;
  }
  if (url.origin !== location.origin) return; // Sync-Anfragen und Fremdquellen nie abfangen

  // Seitenaufrufe: offline immer die App-Shell liefern
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  // Statische Dateien: Cache zuerst, parallel aktualisieren
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
