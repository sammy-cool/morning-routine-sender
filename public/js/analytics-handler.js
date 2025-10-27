// analytics-handler.js
// Fetch/caches API data + feeds Chart.js, persists latest analytics snapshot

const ANALYTICS_DB = "dashboard_analytics";
const ANALYTICS_STORE = "snapshots";

const analyticsDBPromise = (() => {
  if (!window.indexedDB) return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ANALYTICS_DB, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ANALYTICS_STORE)) {
        db.createObjectStore(ANALYTICS_STORE);
      }
    };
  });
})();

// Helper for storing analytics
async function cacheAnalyticsSnapshot(key, data) {
  try {
    if (analyticsDBPromise) {
      const db = await analyticsDBPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(ANALYTICS_STORE, "readwrite");
        const store = tx.objectStore(ANALYTICS_STORE);
        store.put(data, key);
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });
    }
  } catch {}
  // fallback: sessionStorage
  sessionStorage.setItem("analytics_" + key, JSON.stringify(data));
}

async function loadAnalyticsSnapshot(key) {
  try {
    if (analyticsDBPromise) {
      const db = await analyticsDBPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(ANALYTICS_STORE, "readonly");
        const store = tx.objectStore(ANALYTICS_STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    }
  } catch {}
  // fallback: sessionStorage
  const v = sessionStorage.getItem("analytics_" + key);
  return v ? JSON.parse(v) : null;
}

const AnalyticsHandler = {
  // Fetch API, serve from cache if offline or error
  async getAPI(url, cacheKey) {
    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error("API: " + url + " failed");
      const data = await resp.json();
      await cacheAnalyticsSnapshot(cacheKey, { data, t: Date.now() });
      return data;
    } catch (err) {
      // Try local cache snapshot
      const snap = await loadAnalyticsSnapshot(cacheKey);
      if (snap) return snap.data;
      throw err;
    }
  },
  // Expose Chart.js friendly data for trends; expects dashboard API to return daily objects
  async getEmailTrends(range = 7) {
    return this.getAPI(
      `/admin/database-stats?range=${range}`,
      `database-stats-${range}`
    );
  },
  async getScheduledTrends(range = 30) {
    return this.getAPI(
      `/scheduled-jobs?range=${range}`,
      `scheduled-jobs-${range}`
    );
  },
  async getTemplatesUsage() {
    return this.getAPI(
      `/admin/database-stats?field=templates`,
      "templates-usage"
    );
  },
};

window.AnalyticsHandler = AnalyticsHandler; // For app use
