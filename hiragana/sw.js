"use strict";
const CACHE = "hiragana-v3";
const ASSETS = ["./", "index.html", "manifest.webmanifest", "icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      // cache: "reload" bypasses the HTTP cache — without it a stale copy can be
      // precached as if it were new, and no later reload would ever dislodge it
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const stale = keys.filter(k => k !== CACHE);
    await Promise.all(stale.map(k => caches.delete(k)));
    await self.clients.claim();
    // an upgrade, not a first install: whatever is on screen is the old build
    if (stale.length) {
      const windows = await self.clients.matchAll({ type: "window" });
      windows.forEach(w => { try { w.navigate(w.url); } catch (err) { /* client may refuse */ } });
    }
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    // network first for the page itself, so a new build lands on the next load
    // rather than the one after; the cache still covers being offline
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put("index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match("index.html").then(hit => hit || caches.match("./")))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit =>
      hit ||
      fetch(req).then(res => {
        if (res.ok && new URL(req.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
    )
  );
});
