// settings-manager.js
// Universal settings handler: IndexedDB fallback to localStorage

const SETTINGS_DB = "dashboard_settings";
const SETTINGS_STORE = "user_prefs";

const dbPromise = (() => {
  if (!window.indexedDB) return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SETTINGS_DB, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
    };
  });
})();

const SettingsManager = {
  async get(key, fallback = undefined) {
    // Try IndexedDB first
    try {
      if (dbPromise) {
        const db = await dbPromise;
        return new Promise((resolve, reject) => {
          const tx = db.transaction(SETTINGS_STORE, "readonly");
          const store = tx.objectStore(SETTINGS_STORE);
          const req = store.get(key);
          req.onsuccess = () =>
            resolve(req.result !== undefined ? req.result : fallback);
          req.onerror = () => resolve(fallback);
        });
      }
    } catch {}
    // Fallback to localStorage
    const v = localStorage.getItem("setting_" + key);
    return v !== null ? JSON.parse(v) : fallback;
  },
  async set(key, value) {
    // Try IndexedDB
    try {
      if (dbPromise) {
        const db = await dbPromise;
        return new Promise((resolve, reject) => {
          const tx = db.transaction(SETTINGS_STORE, "readwrite");
          const store = tx.objectStore(SETTINGS_STORE);
          store.put(value, key);
          tx.oncomplete = resolve;
          tx.onerror = reject;
        });
      }
    } catch {}
    // Fallback to localStorage
    localStorage.setItem("setting_" + key, JSON.stringify(value));
  },
  async getAll() {
    const prefs = {};
    if (dbPromise) {
      try {
        const db = await dbPromise;
        return new Promise((resolve, reject) => {
          const tx = db.transaction(SETTINGS_STORE, "readonly");
          const store = tx.objectStore(SETTINGS_STORE);
          const req = store.openCursor();
          req.onsuccess = function () {
            const cursor = req.result;
            if (cursor) {
              prefs[cursor.key] = cursor.value;
              cursor.continue();
            } else {
              resolve(prefs);
            }
          };
          req.onerror = () => resolve(prefs);
        });
      } catch {}
    }
    // Fallback to all localStorage entries
    for (const key in localStorage)
      if (key.startsWith("setting_"))
        prefs[key.slice(8)] = JSON.parse(localStorage.getItem(key));
    return prefs;
  },
  async remove(key) {
    if (dbPromise) {
      try {
        const db = await dbPromise;
        return new Promise((resolve, reject) => {
          const tx = db.transaction(SETTINGS_STORE, "readwrite");
          const store = tx.objectStore(SETTINGS_STORE);
          store.delete(key);
          tx.oncomplete = resolve;
          tx.onerror = reject;
        });
      } catch {}
    }
    localStorage.removeItem("setting_" + key);
  },
};

window.SettingsManager = SettingsManager; // for app use
