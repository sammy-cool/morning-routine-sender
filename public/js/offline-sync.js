// public/js/offline-sync.js
/**
 * Offline Sync & Habit Check-in Manager
 * Handles offline interception, IndexedDB / localStorage queueing,
 * Background Sync registration ('sync-morning-checkin'), and customizableToast feedback.
 */
(function () {
  const DB_NAME = "mrn-offline-sync-db";
  const DB_VERSION = 1;
  const STORE_NAME = "checkin_queue";
  const LOCAL_STORAGE_KEY = "mrn_offline_checkins_backup";
  const SYNC_TAG = "sync-morning-checkin";

  // Toast Helper integrating customizable-toast-notification
  function showToast(message, type = "info", options = {}) {
    if (globalThis.UXCore?.toast?.show) {
      return globalThis.UXCore.toast.show(message, type, options);
    }

    const toastLib =
      globalThis.customizableToast ||
      (typeof window !== "undefined" ? window.customizableToast : null);

    if (toastLib && typeof toastLib.createToast === "function") {
      return toastLib.createToast({
        message,
        type: type === "warn" ? "warning" : type,
        position: "top-center",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        borderRadius: "16px",
        showProgressBar: true,
        progressPosition: "bottom",
        progressColor: "#7c3aed",
        pauseOnHover: true,
        duration: 5000,
        ...options,
      });
    }

    if (
      typeof globalThis.ToastManager !== "undefined" &&
      typeof globalThis.ToastManager.show === "function"
    ) {
      globalThis.ToastManager.show({ message, type, ...options });
    }
  }

  // ---------------- INDEXEDDB STORAGE ----------------
  function openDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        return reject(new Error("IndexedDB not supported in this environment"));
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getStoredCheckins() {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (_err) {
      try {
        return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
      } catch (_e) {
        return [];
      }
    }
  }

  async function storeCheckin(item) {
    // 1. Save to IndexedDB
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (_e) {
      // Non-fatal, fallback to localStorage
    }

    // 2. Mirror in localStorage backup
    try {
      const list = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
      list.push(item);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch (_e) {
      // Ignore storage errors
    }
  }

  async function removeStoredCheckin(id) {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (_e) {
      // Ignore db errors
    }

    try {
      let list = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
      list = list.filter((i) => i.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch (_e) {
      // Ignore storage errors
    }
  }

  // ---------------- BACKGROUND SYNC REGISTRATION ----------------
  async function requestBackgroundSync() {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register(SYNC_TAG);
        console.info("[OfflineSync] Background Sync registered successfully for tag:", SYNC_TAG);
        return true;
      } catch (err) {
        console.warn("[OfflineSync] SyncManager registration failed:", err);
      }
    }
    return false;
  }

  // ---------------- QUEUE CHECK-IN ----------------
  async function queueCheckin(options = {}) {
    const id = "checkin_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const item = {
      id,
      url: options.url || null,
      email: options.email || null,
      token: options.token || null,
      method: options.method || "GET",
      body: options.body || null,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    if (!item.url && item.email) {
      item.url = `/checkin?email=${encodeURIComponent(item.email)}${item.token ? `&token=${encodeURIComponent(item.token)}` : ""}`;
    }

    await storeCheckin(item);

    const hasSyncManager = await requestBackgroundSync();

    showToast(
      "⚡ <b>Offline Check-in Saved!</b> Your habit streak will sync automatically when you're back online.",
      "warn",
      {
        duration: 6000,
        allowHtml: true,
      },
    );

    return { id, queued: true, backgroundSync: hasSyncManager };
  }

  // ---------------- DIRECT DRAIN QUEUE (FALLBACK / ONLINE EVENT) ----------------
  async function drainQueue() {
    if (!navigator.onLine) return;

    const items = await getStoredCheckins();
    if (!items || items.length === 0) return;

    console.info(`[OfflineSync] Draining ${items.length} queued check-ins directly...`);

    let syncedCount = 0;
    for (const item of items) {
      try {
        const url =
          item.url ||
          `/checkin?email=${encodeURIComponent(item.email)}${item.token ? `&token=${encodeURIComponent(item.token)}` : ""}`;

        const res = await fetch(url, {
          method: item.method || "GET",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "X-Offline-Sync": "true",
            Accept: "application/json, text/html, */*",
          },
        });

        if (res.ok || res.status < 400) {
          await removeStoredCheckin(item.id);
          syncedCount++;
        }
      } catch (e) {
        console.warn("[OfflineSync] Failed to sync item:", item.id, e);
      }
    }

    if (syncedCount > 0) {
      showToast(
        "🔥 <b>Habit Check-in Synced!</b> Your morning routine streak is safe and up to date.",
        "success",
        {
          duration: 5000,
          allowHtml: true,
        },
      );

      // Trigger UI updates if on live routine / dashboard
      document.querySelectorAll(".btn-checkin, [data-action='checkin']").forEach((btn) => {
        btn.classList.add("checked-in");
        if (btn.tagName === "BUTTON") {
          btn.innerHTML = '🔥 Streak Maintained <i class="fas fa-check"></i>';
        }
      });
    }
  }

  // ---------------- INTERCEPTOR INITIALIZATION ----------------
  function initClickInterceptors() {
    document.addEventListener("click", function (event) {
      const target = event.target.closest(
        '.btn-checkin, a[href*="/checkin"], [data-action="checkin"], #routineCheckinBtn, #dashboardCheckinBtn',
      );

      if (!target) return;

      // Extract details
      let href = target.getAttribute("href") || "";
      let email = target.getAttribute("data-email") || "";
      let token = target.getAttribute("data-token") || "";

      if (href) {
        try {
          const parsed = new URL(href, window.location.origin);
          if (parsed.pathname === "/checkin") {
            email = email || parsed.searchParams.get("email") || "";
            token = token || parsed.searchParams.get("token") || "";
          }
        } catch (_e) {
          // Ignore URL parsing errors
        }
      }

      // If offline, intercept and queue
      if (!navigator.onLine) {
        event.preventDefault();
        event.stopPropagation();

        queueCheckin({ url: href, email, token });

        if (target.classList.contains("btn-checkin")) {
          target.innerText = "⚡ Queued for Sync (Offline)";
        }
      }
    });
  }

  // ---------------- EVENT LISTENERS & LIFECYCLE ----------------
  function init() {
    // 1. Register Service Worker if supported
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "SYNC_CHECKIN_SUCCESS") {
          showToast(
            "🔥 <b>Habit Check-in Synced!</b> Your morning routine streak has been updated.",
            "success",
            { allowHtml: true },
          );
        }
      });
    }

    // 2. Listen to network restoration
    window.addEventListener("online", () => {
      console.info("[OfflineSync] Network restored. Checking for queued sync items...");
      drainQueue();
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "DRAIN_CHECKIN_QUEUE" });
      }
    });

    // 3. Intercept check-in actions
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initClickInterceptors);
    } else {
      initClickInterceptors();
    }
  }

  init();

  globalThis.OfflineSync = {
    queueCheckin,
    drainQueue,
    getStoredCheckins,
    requestBackgroundSync,
    showToast,
  };
})();
