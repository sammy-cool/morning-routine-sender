const CACHE_VERSION = "v3.0.0"; // ← Have to Increment on each deploy for cache isolation purposes (see https://developers.google.com/web/fundamentals/primers/service-workers/#update_a_service_worker)
const CACHE_NAME = `mrn-pwa-${CACHE_VERSION}`;

const urlsToCache = [
  "/favicon.ico",
  "/manifest.json",
  "/css/loader.css",
  "/assets/mrn-brand-ico.png",

  "/",

  "/js/settings-manager.js",
  "/js/analytics-handler.js",

  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/customizable-toast-notification@latest/dist/index.umd.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
];

const DATA_API_ENDPOINTS = ["/admin/database-stats", "/scheduled-jobs"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching all assets");
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (DATA_API_ENDPOINTS.some((ep) => url.pathname.startsWith(ep))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, respClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            return (
              cachedResponse ||
              new Response(JSON.stringify({ offline: true }), {
                headers: { "Content-Type": "application/json" },
              })
            );
          });
        })
    );
    return;
  }

  if (event.request.method !== "GET") {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).then((fetchResponse) => {
          const fetchClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, fetchClone);
          });
          return fetchResponse;
        })
      );
    })
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
//         Promise
// .all(
//           names.map((name) =>
//             name === CACHE_NAME ? null : caches.delete(name)
//           )
//         )
//       )
//   );
//   return self.clients.claim();
// });
