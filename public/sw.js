const CACHE_VERSION = "v4.4.0";
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
const DB_VERSION = 2;
const STORE_NAME = "checkin_queue";
const JOURNAL_STORE = "journal_queue";

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
      if (!db.objectStoreNames.contains(JOURNAL_STORE)) {
        db.createObjectStore(JOURNAL_STORE, { keyPath: "id" });
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

function getQueuedJournals(db) {
  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(JOURNAL_STORE)) {
        return resolve([]);
      }
      const tx = db.transaction(JOURNAL_STORE, "readonly");
      const store = tx.objectStore(JOURNAL_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

function deleteQueuedJournal(db, id) {
  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(JOURNAL_STORE)) {
        return resolve();
      }
      const tx = db.transaction(JOURNAL_STORE, "readwrite");
      const store = tx.objectStore(JOURNAL_STORE);
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

async function drainOfflineJournalQueue() {
  console.info("[SW] ✍️ Draining offline reflection journal queue...");
  let db;
  try {
    db = await openIndexedDB();
  } catch (err) {
    console.warn("[SW] Could not access IndexedDB for journal sync:", err.message);
    return;
  }

  try {
    const queue = await getQueuedJournals(db);
    if (!queue || queue.length === 0) {
      console.info("[SW] No pending journals in offline queue.");
      return;
    }

    console.info(`[SW] Found ${queue.length} offline journal(s) to synchronize.`);

    for (const item of queue) {
      try {
        let requestUrl = item.url || "/api/journal/save";
        if (item.email && item.token && !requestUrl.includes("token=")) {
          const sep = requestUrl.includes("?") ? "&" : "?";
          requestUrl += `${sep}email=${encodeURIComponent(item.email)}&token=${encodeURIComponent(item.token)}`;
        }

        const headers = {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-Offline-Sync": "true",
          Accept: "application/json",
          ...(item.headers || {}),
        };

        const response = await fetch(requestUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(item.payload || item.body || {}),
        });

        if (response.ok || response.status < 400) {
          console.info("[SW] ✅ Journal synced successfully for ID:", item.id);
          await deleteQueuedJournal(db, item.id);

          const clientList = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
          });

          for (const client of clientList) {
            client.postMessage({
              type: "SYNC_JOURNAL_SUCCESS",
              id: item.id,
              timestamp: item.timestamp || Date.now(),
              message: "Morning reflection synced successfully!",
            });
          }

          if (clientList.length === 0 && self.registration?.showNotification) {
            await self.registration
              .showNotification("✍️ Morning Reflection Synced!", {
                body: "Your offline mindset reflection has been saved.",
                icon: "/assets/mrn-brand-ico.png",
                badge: "/assets/mrn-brand-ico.png",
                tag: "journal-sync-success",
                data: { url: "/user-dashboard" },
              })
              .catch(() => {});
          }
        } else {
          console.warn("[SW] Server rejected journal sync with status:", response.status);
        }
      } catch (itemError) {
        console.warn("[SW] Network failed while syncing journal; will retry next sync:", itemError);
        throw itemError;
      }
    }
  } catch (err) {
    console.error("[SW] Fatal error in drainOfflineJournalQueue:", err);
    throw err;
  }
}

// ---------------- BACKGROUND SYNC EVENT LISTENER ----------------
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-morning-checkin") {
    console.info("[SW] 🔄 Background Sync event received: sync-morning-checkin");
    event.waitUntil(drainOfflineCheckinQueue());
  } else if (event.tag === "sync-morning-journal" || event.tag === "sync-reflection-journal") {
    console.info("[SW] 🔄 Background Sync event received: sync-morning-journal");
    event.waitUntil(drainOfflineJournalQueue());
  }
});

// ---------------- POSTMESSAGE HANDLER (ONLINE SYNC TRIGGER) ----------------
self.addEventListener("message", (event) => {
  if (event.data?.type === "DRAIN_CHECKIN_QUEUE") {
    event.waitUntil(drainOfflineCheckinQueue());
  } else if (event.data?.type === "DRAIN_JOURNAL_QUEUE") {
    event.waitUntil(drainOfflineJournalQueue());
  } else if (event.data?.type === "DRAIN_ALL_QUEUES") {
    event.waitUntil(Promise.all([drainOfflineCheckinQueue(), drainOfflineJournalQueue()]));
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
    event.respondWith(
      fetch(req).catch(() => {
        const isJson =
          req.headers.get("accept")?.includes("application/json") || url.pathname.includes("/api");
        if (isJson) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Network unavailable. Please check your connection.",
              offline: true,
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/verify")) {
          return new Response(
            "<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Admin Offline</title><style>body{background:#050608;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;box-sizing:border-box;}</style></head><body><div style='text-align:center;max-width:420px;padding:32px;background:rgba(12,17,29,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:20px;'><h2>⚠️ Admin Offline</h2><p style='color:#94a3b8;margin-top:8px;'>Administrative operations require an active network connection.</p></div></body></html>",
            { status: 503, headers: { "Content-Type": "text/html" } },
          );
        }
        return (
          caches.match("/offline") ||
          new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
        );
      }),
    );
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

  // Action: 1-Click Background Check-in directly from notification action button
  if (action === "checkin" && notifData.checkinUrl) {
    event.waitUntil(
      fetch(notifData.checkinUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-offline-sync": "true",
          Accept: "application/json",
        },
      })
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error("Checkin status " + res.status)),
        )
        .then((data) => {
          const streak = data.streakCount || (notifData.streak ? notifData.streak + 1 : 1);
          return self.registration.showNotification("🔥 Habit Streak Maintained!", {
            body: `Day ${streak} completed! Your morning focus streak is locked in.`,
            icon: "/assets/mrn-brand-ico.png",
            badge: "/assets/mrn-brand-ico.png",
            tag: "checkin-confirmation",
            data: { url: notifData.url || "/routine" },
          });
        })
        .catch(() => {
          return self.registration.showNotification("⚡ Check-in Saved", {
            body: "Your check-in will automatically sync as soon as you are reconnected.",
            icon: "/assets/mrn-brand-ico.png",
            badge: "/assets/mrn-brand-ico.png",
            tag: "checkin-confirmation",
            data: { url: notifData.url || "/routine" },
          });
        }),
    );
    return;
  }

  // Action: Snooze 15 minutes
  if (action === "snooze") {
    event.waitUntil(
      new Promise((resolve) => {
        setTimeout(
          () => {
            self.registration
              .showNotification(event.notification.title || "🌅 Morning Focus Reminder", {
                body: "15 minutes have elapsed. Ready to start your focus sprint?",
                icon: "/assets/mrn-brand-ico.png",
                badge: "/assets/mrn-brand-ico.png",
                tag: "morning-routine-snooze",
                requireInteraction: true,
                data: notifData,
                actions: [
                  { action: "checkin", title: "🔥 Check-in Now" },
                  { action: "open_routine", title: "⚡ Start Ritual" },
                ],
              })
              .then(resolve)
              .catch(resolve);
          },
          15 * 60 * 1000,
        );
      }),
    );
    return;
  }

  let targetUrl = notifData.url || "/routine";
  if (action === "open_dashboard") {
    targetUrl = notifData.dashboardUrl || "/user-dashboard";
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
