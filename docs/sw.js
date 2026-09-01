const CACHE_NAME = 'bible-study-v8';
const VAPID_PUBLIC_KEY = 'BBXso6T-C1Ft59FLWrdRfANGYtKm21CHUktfb0rsmfDZOEJSFyn5Y62f2ZaFMr0PxiPCIyN9Wm6_8MxXMQ6AGuY';
const PUSH_WORKER = 'https://devotional-push.cloudflare-dust598.workers.dev';

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

// The ESV is the only translation fetched at runtime, because its licence does
// not allow the text to be stored the way KJV, BSB, ASV, NET and WEB are. That
// makes it the site's one visible single point of failure: it is also the
// default translation, so if the proxy or api.esv.org is having a bad day, the
// first thing every visitor sees is an error while five working translations
// sit one click away.
const ESV_PROXY = 'https://esv-proxy.cloudflare-dust598.workers.dev';

// Fetch: scripture is cache-first, everything else is network-first.
self.addEventListener('fetch', event => {
  const req = event.request;

  // Passages already fetched are served from cache immediately and refreshed in
  // the background. Scripture text does not change, so there is nothing to be
  // gained by waiting on the network, and this makes repeat visits instant and
  // offline reading work.
  if (req.method === 'GET' && req.url.startsWith(ESV_PROXY)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);

      const fromNetwork = fetch(req)
        .then(res => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      if (cached) {
        // Revalidate without making the page wait for it. waitUntil keeps the
        // worker alive long enough for the update to finish.
        event.waitUntil(fromNetwork);
        return cached;
      }
      return (await fromNetwork) || Response.error();
    })());
    return;
  }

  // Everything else: network-first with cache fallback.
  event.respondWith(
    fetch(req)
      .then(response => {
        // Cache successful responses for offline use
        if (response.ok && req.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return response;
      })
      .catch(() => caches.match(req))
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

// The browser/OS can silently rotate a subscriber's push endpoint (this
// happens periodically, especially on iOS) — without catching this event
// the old endpoint just goes dead, the worker's next send deletes it after
// a 404/410, and the subscriber stops getting reminders with zero warning.
// Re-subscribing here and telling the server about the swap (preserving
// their chosen hourUTC) is what makes reminders keep working long-term.
self.addEventListener('pushsubscriptionchange', event => {
  const oldEndpoint = event.oldSubscription ? event.oldSubscription.endpoint : null;
  event.waitUntil((async () => {
    try {
      const newSubscription = event.newSubscription
        || await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      const payload = newSubscription.toJSON();
      payload.oldEndpoint = oldEndpoint;
      await fetch(PUSH_WORKER + '/resubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) { /* nothing more we can do from here; next push will just fail silently again */ }
  })());
});

function urlBase64ToUint8Array(base64String) {
  const base64 = base64String.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

self.addEventListener('notificationclick', event => {
  const targetUrl = (event.notification.data && event.notification.data.url) || '/devotional.html';
  event.notification.close();
  event.waitUntil((async () => {
    // iOS can launch this installed PWA at start_url on a cold notification
    // tap, ignoring navigate()/openWindow() below entirely (a known WebKit
    // limitation). Stash the real destination so index.html's own redirect
    // fallback can self-correct once it loads.
    try {
      const navCache = await caches.open('nav-intent');
      await navCache.put('/__nav-intent', new Response(targetUrl));
    } catch (e) { /* best effort */ }

    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clientList) {
      if ('focus' in c) {
        // An already-open window (e.g. still on the start_url Bible tab)
        // needs to be explicitly navigated, not just focused, or the
        // notification tap silently lands wherever that window already was.
        if ('navigate' in c) {
          try { await c.navigate(targetUrl); } catch (e) { /* same-origin nav should always be allowed; ignore if not */ }
        }
        return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});
