// public/sw.js
// Service Worker — PWA static asset cache only (NOT HTML)

// FIX: HTML ("/") cache করা বন্ধ — পুরানো project এর content leak হবে না
// FIX: Navigate requests ignore — SPA always network from

const CACHE_NAME = "alhamid-v3-2026-11-12";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {})),
  );
  self.skipWaiting();
});

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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip: supabase, server functions, HTML navigation, root path
  if (
    url.hostname.includes("supabase") ||
    url.pathname.startsWith("/_serverFn") ||
    url.pathname.startsWith("/api/") ||
    req.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/index.html"
  ) {
    return;
  }

  // Static assets only — network-first, cache fallback
  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(req).then((cached) => cached || new Response("Offline", { status: 503 }));
      }),
  );
});