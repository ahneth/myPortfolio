const CACHE_NAME = "myportfolio-cache-v3.4.5-20261111_2110";
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

// Network-First strategy ONLY for same-origin App Shell assets;
// NEVER intercept cross-origin API/CORS proxy calls or live JSON data files!
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  try {
    const reqUrl = new URL(event.request.url);
    // Do not intercept cross-origin requests (Cloudflare Worker, Yahoo CORS proxies, GitHub API, etc.)
    if (reqUrl.origin !== self.location.origin) return;
    // Do not intercept dynamic data JSON files so they are always fetched fresh from network
    if (reqUrl.pathname.endsWith("historical_prices.json") || reqUrl.pathname.endsWith("company_news.json")) {
      return;
    }
  } catch (_) {
    return;
  }

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
