const CACHE_NAME = "tanidik-static-v2";

const CACHE_FIRST_ASSETS = [
  "/assets/favicon.svg",
  "/assets/social-preview.png",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/manifest.webmanifest"
];

const NETWORK_FIRST_ASSETS = [
  "/css/style.css",
  "/js/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CACHE_FIRST_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

function isSameOriginGet(request) {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);

  return url.origin === self.location.origin;
}

function shouldNetworkFirst(request, url) {
  return (
    request.mode === "navigate" ||
    NETWORK_FIRST_ASSETS.includes(url.pathname) ||
    url.pathname.endsWith(".html")
  );
}

function shouldCacheFirst(url) {
  return CACHE_FIRST_ASSETS.includes(url.pathname);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) return cachedResponse;

    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);

  if (response && response.ok) {
    cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (!isSameOriginGet(request)) return;

  const url = new URL(request.url);

  if (shouldNetworkFirst(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (shouldCacheFirst(url)) {
    event.respondWith(cacheFirst(request));
  }
});
