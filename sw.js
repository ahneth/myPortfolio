const CACHE_NAME = "myportfolio-cache-v3.0.1-20261031_1115";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./version.js",
  "./logger.js",
  "./utils.js",
  "./api.js",
  "./portfolio.js",
  "./charts.js",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith("historical_prices.json") || url.pathname.endsWith("company_news.json")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
