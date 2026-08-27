"use strict";
// Tombstone. The old Hiragana app moved to /yomikana/. Browsers re-fetch this
// file on navigation, so the previous worker updates to this one, which takes
// itself out of the picture instead of serving a stale cache of a dead app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("hiragana-")).map(k => caches.delete(k)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: "window" });
    windows.forEach(w => { try { w.navigate("/yomikana/"); } catch (err) { /* client may refuse */ } });
  })());
});
// no fetch handler: every request goes straight to the network
