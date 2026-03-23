// YourTube Service Worker
const CACHE_NAME = 'yourtube-v2';
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Network first, fallback to cache
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return; // never cache API
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Background sync: cek channel baru tiap 30 menit
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-channels') {
    e.waitUntil(checkNewVideos());
  }
});

// Push notification handler
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  self.registration.showNotification(data.title || 'YourTube', {
    body: data.body || 'Ada video baru!',
    icon: 'https://www.youtube.com/favicon.ico',
    badge: 'https://www.youtube.com/favicon.ico',
    data: { url: data.url || '/' },
    actions: [{ action: 'open', title: 'Tonton Sekarang' }]
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.openWindow(url));
});

async function checkNewVideos() {
  try {
    const clients2 = await self.clients.matchAll();
    if (clients2.length === 0) return; // hanya cek kalau app terbuka

    // Ambil pinned channels dari message
    const pinned = JSON.parse(await getStore('yt_pinned') || '[]');
    if (!pinned.length) return;

    for (const ch of pinned.slice(0, 3)) {
      const url = `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=' + ch.id)}`;
      const r = await fetch(url);
      const j = await r.json();
      if (!j.contents) continue;
      const xml = new DOMParser().parseFromString(j.contents, 'text/xml');
      const latest = xml.querySelector('entry');
      if (!latest) continue;
      const vidId = latest.querySelector('videoId')?.textContent;
      const title = latest.querySelector('title')?.textContent;
      const lastSeen = await getStore('yt_lastseen_' + ch.id);
      if (vidId && vidId !== lastSeen) {
        await setStore('yt_lastseen_' + ch.id, vidId);
        if (lastSeen) { // bukan pertama kali
          self.registration.showNotification(`🔔 ${ch.name} upload baru!`, {
            body: title,
            icon: 'https://www.youtube.com/favicon.ico',
            data: { url: `/#watch=${vidId}` }
          });
        }
      }
    }
  } catch(e) {}
}

// Simple KV store via IndexedDB (simplified)
function getStore(key) {
  return new Promise(res => {
    try {
      const req = indexedDB.open('yt-sw', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
      req.onsuccess = e => {
        const tx = e.target.result.transaction('kv', 'readonly');
        const r = tx.objectStore('kv').get(key);
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      };
      req.onerror = () => res(null);
    } catch(e) { res(null); }
  });
}
function setStore(key, val) {
  return new Promise(res => {
    try {
      const req = indexedDB.open('yt-sw', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
      req.onsuccess = e => {
        const tx = e.target.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(val, key);
        tx.oncomplete = res;
        tx.onerror = res;
      };
    } catch(e) { res(); }
  });
}
