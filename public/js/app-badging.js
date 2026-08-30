/* global module */
/**
 * Morning Routine Sender - PWA App Badging & Native Streak Icon
 * File: public/js/app-badging.js
 *
 * Provides resilient, cross-platform integration with the W3C App Badging API
 * (navigator.setAppBadge / navigator.clearAppBadge) to display unbroken habit
 * streaks directly on the OS taskbar, macOS Dock, Android app icon, or PWA launcher.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "mrn_current_streak_badge";

  /**
   * Check whether App Badging API is supported by the current browser/environment.
   * @returns {boolean}
   */
  function isSupported() {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.setAppBadge === "function" &&
      typeof navigator.clearAppBadge === "function"
    );
  }

  /**
   * Set the PWA application badge count.
   * If count <= 0, automatically falls back to clearAppBadge().
   * @param {number|string} count - The habit streak count
   * @returns {Promise<boolean>} Resolves true if badge was successfully set/cleared
   */
  async function setAppBadge(count) {
    const num = Math.max(0, parseInt(count, 10) || 0);

    if (num <= 0) {
      return clearAppBadge();
    }

    if (!isSupported()) {
      return false;
    }

    try {
      await navigator.setAppBadge(num);
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(STORAGE_KEY, String(num));
        }
      } catch (_storageErr) {
        // Ignore local storage error
      }
      return true;
    } catch (err) {
      console.warn("[AppBadging] navigator.setAppBadge error:", err);
      return false;
    }
  }

  /**
   * Clear the PWA application badge.
   * @returns {Promise<boolean>} Resolves true if badge was successfully cleared
   */
  async function clearAppBadge() {
    if (!isSupported()) {
      return false;
    }

    try {
      await navigator.clearAppBadge();
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (_storageErr) {
        // Ignore local storage error
      }
      return true;
    } catch (err) {
      console.warn("[AppBadging] navigator.clearAppBadge error:", err);
      return false;
    }
  }

  /**
   * Synchronize the badge with a given habit streak count.
   * If streak > 0, sets badge to streak count.
   * If streak === 0 or invalid, clears badge.
   * @param {number|string} streakCount
   * @returns {Promise<boolean>}
   */
  async function updateStreakBadge(streakCount) {
    const streak = Math.max(0, parseInt(streakCount, 10) || 0);
    if (streak > 0) {
      return setAppBadge(streak);
    }
    return clearAppBadge();
  }

  /**
   * Synchronize the badge directly from a subscriber profile object.
   * @param {Object} subscriber
   * @returns {Promise<boolean>}
   */
  async function syncFromSubscriber(subscriber) {
    if (!subscriber) return clearAppBadge();
    const streak = subscriber.streakCount ?? subscriber.streak ?? 0;
    return updateStreakBadge(streak);
  }

  /**
   * Retrieve cached badge/streak count from localStorage.
   * @returns {number}
   */
  function getCachedStreak() {
    try {
      if (typeof localStorage !== "undefined") {
        const val = localStorage.getItem(STORAGE_KEY);
        return val ? parseInt(val, 10) || 0 : 0;
      }
    } catch (_e) {
      // Ignore local storage error
    }
    return 0;
  }

  const AppBadging = {
    isSupported,
    setAppBadge,
    clearAppBadge,
    updateStreakBadge,
    syncFromSubscriber,
    getCachedStreak,
  };

  // Expose to global scope (Window / WorkerGlobalScope / globalThis)
  if (typeof global !== "undefined") {
    global.AppBadging = AppBadging;
  }

  // CommonJS export support for tests/Node environment
  if (typeof module !== "undefined" && module.exports) {
    module.exports = AppBadging;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
