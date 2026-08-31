const CACHE_VERSION = "v4.3.0";
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
  "/js/offline-sync.js",
  "/js/app-badging.js",
  "/js/ux-core.js",
];

// External CDN vendor libs to cache
const VENDOR_LIBS = [
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
  "https://cdn.jsdelivr.net/npm/customizable-toast-notification@latest/dist/index.umd.js",
];

// ---------------- INDEXEDDB OFFLINE QUEUE UTILS ----------------
const DB_NAME = "mrn-offline-sync-db";
const DB_VERSION = 1;
const STORE_NAME = "checkin_queue";

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB is not supported"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getQueuedCheckins(db) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

function deleteQueuedCheckin(db, id) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Drain offline habit check-ins and send to /checkin or /api/subscribers/checkin
 */
async function drainOfflineCheckinQueue() {
  console.info("[SW] ⚡ Draining offline habit check-in queue...");
  let db;
  try {
    db = await openIndexedDB();
  } catch (err) {
    console.warn("[SW] Could not access IndexedDB for sync:", err.message);
    return;
  }

  try {
    const queue = await getQueuedCheckins(db);
    if (!queue || queue.length === 0) {
      console.info("[SW] No pending check-ins in offline queue.");
      return;
    }

    console.info(`[SW] Found ${queue.length} offline check-in(s) to synchronize.`);

    for (const item of queue) {
      try {
        let requestUrl = item.url;
        const method = item.method || (item.body ? "POST" : "GET");
        const headers = {
          "X-Requested-With": "XMLHttpRequest",
          "X-Offline-Sync": "true",
          Accept: "application/json, text/html, */*",
          ...(item.headers || {}),
        };

        if (!requestUrl) {
          if (item.email && item.token) {
            requestUrl = `/checkin?email=${encodeURIComponent(item.email)}&token=${encodeURIComponent(item.token)}`;
          } else if (item.email) {
            requestUrl = `/checkin?email=${encodeURIComponent(item.email)}`;
          } else {
            requestUrl = "/checkin";
          }
        }

        const fetchOptions = { method, headers };
        if (method === "POST" && item.body) {
          headers["Content-Type"] = "application/json";
          fetchOptions.body = typeof item.body === "string" ? item.body : JSON.stringify(item.body);
        }

        const response = await fetch(requestUrl, fetchOptions);
        if (response.ok || response.status < 400) {
          console.info("[SW] ✅ Check-in synced successfully for ID:", item.id);
          await deleteQueuedCheckin(db, item.id);

          // Broadcast sync success to all active client tabs
          const clientList = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
          });

          for (const client of clientList) {
            client.postMessage({
              type: "SYNC_CHECKIN_SUCCESS",
              id: item.id,
              email: item.email,
              timestamp: item.timestamp || Date.now(),
              message: "Habit check-in synced successfully!",
            });
          }

          // If no window is open, display background notification
          if (clientList.length === 0 && self.registration?.showNotification) {
            await self.registration
              .showNotification("🔥 Habit Streak Synced!", {
                body: "Your offline morning routine check-in was synchronized successfully.",
                icon: "/assets/mrn-brand-ico.png",
                badge: "/assets/mrn-brand-ico.png",
                tag: "checkin-sync-success",
                data: { url: "/user-dashboard" },
              })
              .catch(() => {});
          }
        } else {
          console.warn("[SW] Server rejected check-in sync with status:", response.status);
        }
      } catch (itemError) {
        console.warn("[SW] Network failed while syncing item; will retry next sync:", itemError);
        throw itemError;
      }
    }
  } catch (err) {
    console.error("[SW] Fatal error in drainOfflineCheckinQueue:", err);
    throw err;
  }
}

// ---------------- BACKGROUND SYNC EVENT LISTENER ----------------
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-morning-checkin") {
    console.info("[SW] 🔄 Background Sync event received: sync-morning-checkin");
    event.waitUntil(drainOfflineCheckinQueue());
  }
});

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
        }),
      );
      await Promise.all(promises);
    }),
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
            }),
        ),
      )
      .then(() => self.clients.claim()),
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
            { headers: { "Content-Type": "text/html" } },
          );
        }
        return caches.match("/offline");
      }),
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
        .catch(() => caches.match(req)),
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
    }),
  );
});

// ---------------- MESSAGE LISTENER ----------------
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data && event.data.type === "UPDATE_APP_BADGE") {
    const count = parseInt(event.data.streakCount || event.data.streak || 0, 10);
    if (typeof navigator !== "undefined" && typeof navigator.setAppBadge === "function") {
      if (count > 0) {
        navigator.setAppBadge(count).catch(() => {});
      } else if (typeof navigator.clearAppBadge === "function") {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  } else if (event.data && event.data.type === "CLEAR_APP_BADGE") {
    if (typeof navigator !== "undefined" && typeof navigator.clearAppBadge === "function") {
      navigator.clearAppBadge().catch(() => {});
    }
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
    } catch (_e) {
      data.body = event.data.text() || data.body;
    }
  }

  // Update native app badge to current streak
  const streak =
    parseInt(data.streak || data.streakCount || (data.data && data.data.streak) || 1, 10) || 1;
  const badgePromise =
    typeof navigator !== "undefined" && typeof navigator.setAppBadge === "function"
      ? navigator.setAppBadge(streak).catch(() => {})
      : Promise.resolve();

  const notifPromise = self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon || "/assets/mrn-brand-ico.png",
    badge: data.badge || "/assets/mrn-brand-ico.png",
    tag: data.tag || "morning-routine-reminder",
    renotify: data.renotify !== undefined ? data.renotify : true,
    data: data.data || { url: "/routine" },
    actions: data.actions || [],
  });

  event.waitUntil(Promise.all([badgePromise, notifPromise]));
});

// ---------------- NOTIFICATION CLICK EVENT LISTENER ----------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || "/routine";

  if (action === "open_dashboard") {
    targetUrl = notifData.dashboardUrl || "/user-dashboard";
  } else if (action === "checkin") {
    targetUrl = "/checkin";
  } else if (action === "open_routine") {
    targetUrl = notifData.url || "/routine";
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
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
    }),
  );
});
