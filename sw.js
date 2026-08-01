/* BuildMyBill service worker.
   Network-first for same-origin GETs so new deploys always win; the cache is
   only a fallback when offline. Supabase (cross-origin) requests pass straight
   through and are never cached. */
const CACHE = "bmb-v2";
const SHELL = [
  "./", "./index.html", "./config.js", "./manifest.webmanifest",
  "./vendor/react.production.min.js", "./vendor/react-dom.production.min.js",
  "./vendor/supabase.js", "./vendor/babel.min.js",
  "./icon-192.png", "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // let API/Supabase/storage pass

  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});
