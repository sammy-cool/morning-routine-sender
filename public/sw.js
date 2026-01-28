const CACHE_VERSION = "v3.0.2";
const CACHE_NAME = `mrn-pwa-${CACHE_VERSION}`;

// STATIC ASSETS ONLY (NO HTML, NO AUTH)
const STATIC_ASSETS = [
  "/favicon.ico",
  "/manifest.json",

  "/css/loader.css",

  "/assets/mrn-brand-ico.png",
  "/assets/screenshot-desktop.png",
  "/assets/screenshot-mobile.png",

  "/js/settings-manager.js",
  "/js/analytics-handler.js",

  // SELF-HOSTED or PINNED ONLY
  // "/js/customizable-toast-notification.js",
  "https://cdn.jsdelivr.net/npm/customizable-toast-notification@3.11.0/dist/index.umd.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",

  // OFFLINE PAGE
  "/offline",
];

// APIs allowed to cache (network-first)
const PUBLIC_API_ENDPOINTS = ["/scheduled-jobs"];

const ADMIN_API_ENDPOINTS = ["/admin/"];

// ---------------- INSTALL ----------------
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// ---------------- ACTIVATE ----------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );

  self.clients.claim();
});

// ---------------- FETCH ----------------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. NEVER CACHE NAVIGATION / HTML
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => {
        const path = new URL(req.url).pathname;

        // 🚨 Admin routes NEVER offline
        if (
          path === "/" ||
          path.startsWith("/admin") ||
          path.startsWith("/verify")
        ) {
          return new Response(
            "<h1>Offline</h1><p>Admin access requires or maybe your internet connection is down.</p>",
            { headers: { "Content-Type": "text/html" } }
          );
        }

        // ✅ Public offline fallback
        return caches.match("/offline");
      })
    );
    return;
  }

  // 2. NEVER CACHE AUTH ROUTES
  if (
    url.pathname === "/" ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/verify")
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // 3. APIs → NETWORK FIRST
  // 🚨 Admin APIs: network only
  if (ADMIN_API_ENDPOINTS.some((ep) => url.pathname.startsWith(ep))) {
    event.respondWith(fetch(req));
    return;
  }

  // Public APIs: network-first
  if (PUBLIC_API_ENDPOINTS.some((ep) => url.pathname.startsWith(ep))) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 4. STATIC ASSETS → CACHE FIRST
  if (req.method === "GET") {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;

        return fetch(req).then((res) => {
          const type = res.headers.get("content-type") || "";
          if (!type.includes("text/html")) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        });
      })
    );
  }
});
