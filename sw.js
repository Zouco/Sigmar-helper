const C = "sigmar-v12", F = ["./", "index.html", "app.js", "data.js", "armies.js", "factions.js", "icon.svg", "style.css", "manifest.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => c.addAll(F))); });
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
// Network first so updates arrive when online; cache when offline.
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(C).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request))));
