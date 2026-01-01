const CACHE_VERSION = "v3.0.1"; // ← Have to Increment on each deploy for cache isolation purposes (see https://developers.google.com/web/fundamentals/primers/service-workers/#update_a_service_worker)
const CACHE_NAME = `mrn-pwa-${CACHE_VERSION}`;

const urlsToCache = [
  "/favicon.ico",
  "/manifest.json",
  "/css/loader.css",
  "/assets/mrn-brand-ico.png",
  "/assets/screenshot-desktop.png",
  "/assets/screenshot-mobile.png",

  "/js/settings-manager.js",
  "/js/analytics-handler.js",

  "https://cdn.jsdelivr.net/npm/customizable-toast-notification@latest/dist/index.umd.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
];

const DATA_API_ENDPOINTS = ["/admin/database-stats", "/scheduled-jobs"];

self.addEventListener("install", (event) => {
  globalThis.skipWaiting();
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
  return globalThis.clients.claim();
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

self.addEventListener("message", (event) => {
  if (event.source != globalThis) {
    console.error("Message received from untrusted origin");
    return;
  }

  if (event.data.action === "skipWaiting") {
    globalThis.skipWaiting();
    console.log("[SW] Message received:", event.data.action);
  }
});

self.addEventListener("push", (event) => {
  const data = event.data.json();
  const notification = new Notification(data.title, data.options);
  notification.onclick = () => window.focus();

  event.waitUntil(notification);

  console.log("[SW] Notification sent");
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  console.log("[SW] Notification closed");
});

self.addEventListener("notificationclose", (event) => {
  console.log(event.reason);
});

self.addEventListener("notificationerror", (event) => {
  console.log(event.error);
});

self.addEventListener("error", (event) => {
  console.error(event.error);
});

self.addEventListener("unhandledrejection", (event) => {
  console.error(event.reason);
});
