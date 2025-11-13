const CACHE_VERSION = "v2.0.0"; // ← Have to Increment on each deploy for cache isolation purposes (see https://developers.google.com/web/fundamentals/primers/service-workers/#update_a_service_worker)
const CACHE_NAME = `mrn-pwa-${CACHE_VERSION}`;
const urlsToCache = [
  // "/",
  // "/favicon.ico",
  // "/assets/mrn-brand-ico.png",
  // "/admin-dashboard.html",
  // "/user-dashboard",
  // "/assets/css/style.css",
  // "/manifest.json",
  // "/js/settings-manager.js",
  // "/js/analytics-handler.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/customizable-toast-notification@latest/dist/index.umd.js",
];

const DATA_API_ENDPOINTS = [
  "/admin/database-stats",
  "/scheduled-jobs", // root endpoint; also supports query params
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

// self.addEventListener("fetch", (event) => {
//   // Network first for analytics API data; fallback to cache
//   const url = new URL(event.request.url);
//   if (DATA_API_ENDPOINTS.some((ep) => url.pathname.startsWith(ep))) {
//     event.respondWith(
//       fetch(event.request)
//         .then((r) => {
//           // Optionally clone and store a backup for analytics-handler.js
//           const rClone = r.clone();
//           caches
//             .open(CACHE_NAME)
//             .then((cache) => cache.put(event.request, rClone));
//           return r;
//         })
//         .catch(() =>
//           caches.match(event.request).then(
//             (r) =>
//               r ||
//               new Response(JSON.stringify({ offline: true }), {
//                 headers: { "Content-Type": "application/json" },
//               })
//           )
//         )
//     );
//     return;
//   }
//   // For others: cache-first fallback
//   event.respondWith(
//     caches
//       .match(event.request)
//       .then((response) => response || fetch(event.request))
//   );
// });

// self.addEventListener("activate", (event) => {
//   event.waitUntil(
//     caches
//       .keys()
//       .then((names) =>
//         Promise.all(
//           names.map((name) =>
//             name === CACHE_NAME ? null : caches.delete(name)
//           )
//         )
//       )
//   );
//   return self.clients.claim();
// });
