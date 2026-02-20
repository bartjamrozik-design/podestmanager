// SetGroom Service Worker — Tryb offline + Push Notifications
const CACHE_NAME = 'setgroom-v1';
const OFFLINE_URLS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap',
];

// ============================================================
// INSTALL — cache essential files
// ============================================================
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(OFFLINE_URLS).catch(() => {
        // Ignore cache failures for external resources
      });
    })
  );
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — clean old caches
// ============================================================
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ============================================================
// FETCH — serve from cache, fallback to network, update cache
// ============================================================
self.addEventListener('fetch', e => {
  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  // For Firebase/Google APIs — network only (don't cache)
  const url = e.request.url;
  if (url.includes('firestore.googleapis.com') ||
      url.includes('firebase') ||
      url.includes('googleapis.com/identitytoolkit')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Return cached version immediately, update in background
      const fetchPromise = fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});

// ============================================================
// PUSH — show notification
// ============================================================
self.addEventListener('push', e => {
  let data = { title: 'SetGroom', body: 'Nowe powiadomienie', icon: '🐾', tag: 'setgroom' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag || 'setgroom',
      renotify: true,
      vibrate: [200, 100, 200],
      data: data.url ? { url: data.url } : {}
    })
  );
});

// ============================================================
// NOTIFICATION CLICK — focus or open app
// ============================================================
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('setgroom') || client.url.includes('localhost')) {
          client.focus();
          return;
        }
      }
      clients.openWindow('./');
    })
  );
});

// ============================================================
// BACKGROUND SYNC — queue offline saves
// ============================================================
self.addEventListener('sync', e => {
  if (e.tag === 'sync-data') {
    // App handles this via IndexedDB when online
    e.waitUntil(Promise.resolve());
  }
});

// ============================================================
// MESSAGE — from main app
// ============================================================
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'NOTIFY') {
    const { title, body, tag } = e.data;
    self.registration.showNotification(title || 'SetGroom', {
      body: body || '',
      tag: tag || 'setgroom',
      vibrate: [200, 100, 200],
      renotify: true,
    });
  }
});
