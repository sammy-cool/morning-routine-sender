const CACHE_VERSION = "v4.2.0";
const CACHE_NAME = `mrn-pwa-${CACHE_VERSION}`;

// STATIC ASSETS ONLY (NO HTML, NO AUTH, NO SUBSCRIBER DATA)
const STATIC_ASSETS = [
  "/favicon.ico",
  "/manifest.json",
  "/css/loader.css",
  "/assets/mrn-brand-ico.png",
  "/assets/screenshot-desktop.png",
  "/assets/screenshot-mobile.png",
  "/offline",
];

// External CDN vendor libs to cache
const VENDOR_LIBS = [
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
  "https://cdn.jsdelivr.net/npm/customizable-toast-notification@latest/dist/index.umd.js",
];

// ---------------- INSTALL ----------------
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const allToCache = [...STATIC_ASSETS, ...VENDOR_LIBS];
      const promises = allToCache.map((url) =>
        cache.add(url).catch((err) => {
          // Non-fatal if remote CDN fails during offline install
          console.warn("[SW] Optional asset skipped:", url, err.message);
        })
      );
      await Promise.all(promises);
    })
  );
});

// ---------------- ACTIVATE ----------------
// Immediately purge ALL previous cache versions and take control of all open tabs
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.info("[SW] Deleting stale cache:", key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---------------- FETCH ----------------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. NEVER CACHE NAVIGATION / HTML (Always Network First)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => {
        const path = url.pathname;
        if (path.startsWith("/admin") || path.startsWith("/verify")) {
          return new Response(
            "<!DOCTYPE html><html><body style='background:#07090e;color:#fff;font-family:sans-serif;padding:40px;text-align:center;'><h2>Admin Offline</h2><p>Administrative actions require an active internet connection.</p></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        }
        return caches.match("/offline");
      })
    );
    return;
  }

  // 2. DYNAMIC & AUTH & SUBSCRIBER APIS → STRICT NETWORK ONLY (NEVER CACHE)
  const isDynamicApi =
    url.pathname.startsWith("/me") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/verify-login") ||
    url.pathname.startsWith("/logout") ||
    url.pathname.startsWith("/subscribe") ||
    url.pathname.startsWith("/confirm-subscription") ||
    url.pathname.startsWith("/checkin") ||
    url.pathname.startsWith("/routine") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/read-db") ||
    url.pathname.startsWith("/send-test-email") ||
    url.pathname.startsWith("/send-bulk-now") ||
    url.pathname.startsWith("/scheduled-jobs") ||
    url.pathname.startsWith("/unsubscribe");

  if (isDynamicApi || req.method !== "GET") {
    event.respondWith(fetch(req));
    return;
  }

  // 3. APPLICATION JS & CSS SCRIPTS → NETWORK FIRST (With Cache Fallback)
  // Guarantees users always get the latest code updates after every deploy!
  const isAppScriptOrStyle =
    url.pathname.startsWith("/js/") ||
    url.pathname.startsWith("/css/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css");

  if (isAppScriptOrStyle && url.origin === location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 4. STATIC IMAGES & VENDOR LIBS → CACHE FIRST (Fast Loading)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => new Response("", { status: 408, statusText: "Asset Unavailable Offline" }));
    })
  );
});

// ---------------- MESSAGE LISTENER ----------------
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---------------- PUSH EVENT LISTENER ----------------
self.addEventListener("push", (event) => {
  let data = {
    title: "🌅 Time for your Morning Routine!",
    body: "Your daily focus ritual is ready. Click to open your live timer & streak check-in.",
    icon: "/assets/mrn-brand-ico.png",
    badge: "/assets/mrn-brand-ico.png",
    tag: "morning-routine-reminder",
    renotify: true,
    data: {
      url: "/routine",
    },
    actions: [
      { action: "open_routine", title: "⚡ Start Ritual" },
      { action: "checkin", title: "🔥 1-Click Check-in" },
    ],
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = Object.assign(data, payload);
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/assets/mrn-brand-ico.png",
      badge: data.badge || "/assets/mrn-brand-ico.png",
      tag: data.tag || "morning-routine-reminder",
      renotify: data.renotify !== undefined ? data.renotify : true,
      data: data.data || { url: "/routine" },
      actions: data.actions || [],
    })
  );
});

// ---------------- NOTIFICATION CLICK EVENT LISTENER ----------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  let targetUrl = "/routine";
  if (event.action === "checkin") {
    targetUrl = "/checkin";
  } else if (event.notification.data && event.notification.data.url) {
    targetUrl = event.notification.data.url;
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === location.origin && "focus" in client) {
            return client.focus().then(() => {
              if (client.navigate) {
                return client.navigate(targetUrl);
              }
            });
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
