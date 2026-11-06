// public/sw.js
// Service Worker — PWA offline caching
// Note: Network-first strategy with cache fallback

const CACHE_NAME = "alhamid-v1";
const STATIC_ASSETS = ["/", "/manifest.webmanifest", "/favicon.ico"];

// Install — pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // some assets may fail — that's fine
      });
    }),
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

// Fetch — network-first, cache fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip supabase API and server functions
  if (
    url.hostname.includes("supabase") ||
    url.pathname.startsWith("/_serverFn") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((response) => {
        // Cache successful GET responses from same origin
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(req).then((cached) => {
          return cached || new Response("Offline", { status: 503 });
        });
      }),
  );
});
