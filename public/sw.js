// phase-15 spec §5.2: read-time caching only — previously-viewed content
// stays available offline via standard service-worker caching. Deliberately
// does NOT queue writes made while offline (POSTs, form submissions) for
// later replay; §5.2 explicitly scopes that out of v1 given the unresolved
// conflict-handling/duplicate-submission design questions it raises.
// Bumped from v1 so the activate handler below purges what the old worker
// cached from /api/* (it cached every GET, including private JSON).
const CACHE_NAME = "0dot-cache-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only GET is safe to cache/replay — a queued POST/PUT/DELETE without a
  // real conflict-resolution design is exactly what §5.2 defers.
  if (request.method !== "GET") return;

  // Never intercept API calls or server-sent-event streams. This worker used
  // to respondWith(fetch(request)) + cache.put(response.clone()) for every GET,
  // and for /api/messages/stream (an endless response) the cloned branch that
  // cache.put keeps reading holds the connection open after the page is gone.
  // Over HTTP/1.1 (6 connections per origin) a few full page loads then left
  // the next load hanging. API responses are also per-user data that has no
  // business sitting in CacheStorage; "previously viewed pages offline" (the
  // point of this worker) is about documents and static assets.
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;
  if ((request.headers.get("accept") || "").includes("text/event-stream")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            new Response("Offline", {
              status: 503,
              statusText: "Offline",
              headers: { "Content-Type": "text/plain" },
            })
        )
      )
  );
});
