const CACHE_NAME = "compras-inteligente-sync-v2";
const ASSETS = ["./","./index.html","./style.css","./data.js","./firebase-config.js","./script.js","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))); });
self.addEventListener("fetch", event => { event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))); });
