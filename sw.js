const CACHE_NAME = "myportfolio-cache-v3.3.7-20261108_1915";
const FETCH_TIMEOUT_MS = 2500;
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

function fetchWithTimeout(request, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { cache: "no-store", signal: controller.signal })
    .then((res) => {
      clearTimeout(timer);
      return res;
    })
    .catch((err) => {
      clearTimeout(timer);
      throw err;
    });
}

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

// Network-First strategy with 2.5s timeout fallback to cache for fast startup on spotty mobile networks
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetchWithTimeout(event.request, FETCH_TIMEOUT_MS)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
