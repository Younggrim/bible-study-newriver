const CACHE_NAME = 'bible-study-v6';

// Install: cache the shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/index.html',
        '/site/style.css',
        '/site/script.js'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for offline use
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push: daily devotional reminder. The push itself carries no payload —
// fetch today's content live so the notification always shows something
// current, with a generic fallback if the fetch is slow or fails (a push
// event that never results in a shown notification can get permission
// revoked by the browser, so this must never silently no-op).
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let title = 'Your Daily Devotional Is Ready';
    let body = "Tap to read today's verse, reflection, and prayer.";
    let icon = '/site/icon-192.png';
    try {
      const [manifest, devos] = await Promise.all([
        fetch('/manifest.json').then(r => r.json()),
        fetch('/devotionals.json').then(r => r.json())
      ]);
      icon = '/' + manifest.icons[0].src.replace(/^\/?/, '');
      const start = new Date(2026, 6, 22); start.setHours(0, 0, 0, 0);
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const diff = Math.floor((now - start) / 86400000);
      const idx = Math.max(0, Math.min(diff, devos.length - 1));
      const entry = devos[idx];
      if (entry) { title = entry.verse; body = entry.reflection; }
    } catch (e) { /* fall through to generic strings above */ }
    return self.registration.showNotification(title, {
      body, icon, badge: icon, tag: 'daily-devotional',
      data: { url: '/devotional.html' }
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const c of clientList) if ('focus' in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow(event.notification.data.url);
    })
  );
});
