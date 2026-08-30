/* global module */
/**
 * Morning Routine Sender - UX Core & Haptic Engine
 * File: public/js/ux-core.js
 * Version: 1.0.0
 *
 * Provides a unified client-side UX subsystem containing:
 * 1. SWR (Stale-While-Revalidate) Cache Engine
 * 2. Mobile Haptic Feedback Engine (Vibration API with resilient guards)
 * 3. Procedural Web Audio Synthesis Engine (Zero external MP3/WAV files)
 * 4. Accessible Keyboard Shortcuts Dispatcher ('c', 'j', 'h', 's', '?', 'Escape')
 * 5. Real-Time Network Status Monitor with Floating Glassmorphic Offline Banner
 */

(function (global) {
  "use strict";

  // =========================================================================
  // 1. SWR (STALE-WHILE-REVALIDATE) CACHE ENGINE
  // =========================================================================
  const SWR_STORAGE_PREFIX = "mrn_swr_cache_";
  const memoryCache = new Map();

  /**
   * Safe localStorage getItem helper.
   * @param {string} key
   * @returns {string|null}
   */
  function safeStorageGet(key) {
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem(key);
      }
    } catch (_e) {
      // Non-fatal: LocalStorage might be disabled or in private mode
    }
    return null;
  }

  /**
   * Safe localStorage setItem helper.
   * @param {string} key
   * @param {string} val
   */
  function safeStorageSet(key, val) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, val);
      }
    } catch (_e) {
      // Non-fatal: Quota exceeded or storage unavailable
    }
  }

  /**
   * Safe localStorage removeItem helper.
   * @param {string} key
   */
  function safeStorageRemove(key) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch (_e) {
      // Non-fatal
    }
  }

  const cache = {
    /**
     * Retrieve a cached entry by key and assess staleness against maxAgeMs.
     * @param {string} key - Cache identifier
     * @param {number} [maxAgeMs=60000] - Staleness threshold in milliseconds (default: 60s)
     * @returns {{ data: any, isStale: boolean, timestamp: number, age: number } | null}
     */
    get(key, maxAgeMs = 60000) {
      if (!key) return null;

      let entry = memoryCache.get(key);

      // Fallback to localStorage if not in memory
      if (!entry) {
        const stored = safeStorageGet(SWR_STORAGE_PREFIX + key);
        if (stored) {
          try {
            entry = JSON.parse(stored);
            if (entry && typeof entry.timestamp === "number") {
              memoryCache.set(key, entry);
            } else {
              entry = null;
            }
          } catch (_err) {
            safeStorageRemove(SWR_STORAGE_PREFIX + key);
            entry = null;
          }
        }
      }

      if (!entry) return null;

      const now = Date.now();
      const age = Math.max(0, now - entry.timestamp);
      const isStale = typeof maxAgeMs === "number" ? age > maxAgeMs : false;

      return {
        data: entry.data,
        isStale,
        timestamp: entry.timestamp,
        age,
      };
    },

    /**
     * Store data in both in-memory Map and localStorage with current timestamp.
     * @param {string} key - Cache identifier
     * @param {any} data - Data payload to cache
     * @returns {{ data: any, timestamp: number }}
     */
    set(key, data) {
      if (!key) return null;

      const entry = {
        data,
        timestamp: Date.now(),
      };

      memoryCache.set(key, entry);
      safeStorageSet(SWR_STORAGE_PREFIX + key, JSON.stringify(entry));

      return entry;
    },

    /**
     * Invalidate and remove a cached item or all cached items.
     * @param {string} [key] - Specific key to invalidate. If omitted, clears all SWR keys.
     */
    invalidate(key) {
      if (key) {
        memoryCache.delete(key);
        safeStorageRemove(SWR_STORAGE_PREFIX + key);
      } else {
        memoryCache.clear();
        try {
          if (typeof localStorage !== "undefined") {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith(SWR_STORAGE_PREFIX)) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
          }
        } catch (_e) {
          // Ignore storage errors
        }
      }
    },

    /**
     * Check if a key exists in cache.
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
      return this.get(key) !== null;
    },

    /**
     * Clear entire cache.
     */
    clear() {
      this.invalidate();
    },
  };

  // =========================================================================
  // 2. MOBILE HAPTIC FEEDBACK ENGINE
  // =========================================================================
  const haptics = {
    /**
     * Verify if the Vibration API is supported and accessible.
     * @returns {boolean}
     */
    isSupported() {
      return (
        typeof navigator !== "undefined" &&
        "vibrate" in navigator &&
        typeof navigator.vibrate === "function"
      );
    },

    /**
     * Trigger vibration pattern with fail-safe error handling.
     * @param {number|number[]} pattern - Millisecond vibration pattern
     * @returns {boolean}
     */
    vibrate(pattern) {
      if (!this.isSupported()) return false;
      try {
        return Boolean(navigator.vibrate(pattern));
      } catch (_err) {
        return false;
      }
    },

    /**
     * Light haptic tap for subtle interactive feedback (15ms).
     * @returns {boolean}
     */
    light() {
      return this.vibrate(15);
    },

    /**
     * Success double-pulse pattern [20ms pulse, 40ms pause, 20ms pulse].
     * @returns {boolean}
     */
    success() {
      return this.vibrate([20, 40, 20]);
    },

    /**
     * Celebration milestone rhythm [30ms, 50ms, 30ms, 50ms, 80ms].
     * @returns {boolean}
     */
    celebration() {
      return this.vibrate([30, 50, 30, 50, 80]);
    },
  };

  // =========================================================================
  // 3. PROCEDURAL WEB AUDIO SYNTHESIS ENGINE
  // =========================================================================
  const SOUND_STORAGE_KEY = "mrn_ux_sound_muted";
  let sharedAudioCtx = null;

  /**
   * Lazily initialize or retrieve the shared AudioContext instance.
   * Handles browser autoplay suspension state seamlessly.
   * @returns {AudioContext|null}
   */
  function getAudioContext() {
    if (typeof window === "undefined") return null;

    const AudioCtxClass =
      window.AudioContext ||
      window.webkitAudioContext ||
      (typeof globalThis !== "undefined" ? globalThis.AudioContext : null);

    if (!AudioCtxClass) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      try {
        sharedAudioCtx = new AudioCtxClass();
      } catch (_e) {
        return null;
      }
    }

    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
  }

  /**
   * Synthesize a single tone with an attack/exponential decay envelope.
   * @param {AudioContext} ctx
   * @param {number} freq - Frequency in Hz
   * @param {number} startTime - AudioContext relative start timestamp
   * @param {number} duration - Note duration in seconds
   * @param {number} [peakGain=0.18] - Peak volume amplitude
   * @param {OscillatorType} [type='sine'] - Waveform type
   */
  function synthesizeTone(ctx, freq, startTime, duration, peakGain = 0.18, type = "sine") {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Volume Envelope: Quick attack to avoid clicking, exponential decay to zero
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_e) {
          // Cleanup
        }
      };
    } catch (_e) {
      // Audio playback fails gracefully
    }
  }

  const sound = {
    /**
     * Check if audio feedback is currently muted.
     * @returns {boolean}
     */
    isMuted() {
      const val = safeStorageGet(SOUND_STORAGE_KEY);
      return val === "true";
    },

    /**
     * Toggle or set the mute state with localStorage persistence.
     * @param {boolean} [isMuted] - Optional explicit boolean value
     * @returns {boolean} Current muted state
     */
    toggleMute(isMuted) {
      const nextState = typeof isMuted === "boolean" ? isMuted : !this.isMuted();
      safeStorageSet(SOUND_STORAGE_KEY, String(nextState));
      return nextState;
    },

    /**
     * Procedural pleasant rising chime:
     * C5 (523.25 Hz) -> E5 (659.25 Hz) -> G5 (783.99 Hz)
     * @returns {boolean}
     */
    playSuccess() {
      if (this.isMuted()) return false;
      const ctx = getAudioContext();
      if (!ctx) return false;

      const now = ctx.currentTime;
      const noteDuration = 0.14;

      // Harmonic rising triad (C Major)
      synthesizeTone(ctx, 523.25, now, noteDuration, 0.16, "sine");
      synthesizeTone(ctx, 659.25, now + 0.08, noteDuration, 0.18, "sine");
      synthesizeTone(ctx, 783.99, now + 0.16, noteDuration * 1.6, 0.2, "sine");

      return true;
    },

    /**
     * Procedural celebratory milestone shimmer chime:
     * Harmonic arpeggio across key frequencies:
     * C5 (523.25 Hz) -> G5 (783.99 Hz) -> C6 (1046.50 Hz) -> E6 (1318.51 Hz)
     * @returns {boolean}
     */
    playMilestone() {
      if (this.isMuted()) return false;
      const ctx = getAudioContext();
      if (!ctx) return false;

      const now = ctx.currentTime;

      const notes = [
        { freq: 523.25, offset: 0.0, dur: 0.22, gain: 0.14, type: "sine" },
        { freq: 659.25, offset: 0.06, dur: 0.22, gain: 0.15, type: "triangle" },
        { freq: 783.99, offset: 0.12, dur: 0.26, gain: 0.17, type: "sine" },
        { freq: 1046.5, offset: 0.18, dur: 0.32, gain: 0.19, type: "sine" },
        { freq: 1318.51, offset: 0.24, dur: 0.45, gain: 0.22, type: "triangle" },
      ];

      notes.forEach((n) => {
        synthesizeTone(ctx, n.freq, now + n.offset, n.dur, n.gain, n.type);
      });

      return true;
    },
  };

  // =========================================================================
  // 4. KEYBOARD SHORTCUTS DISPATCHER
  // =========================================================================
  const shortcutHandlers = new Map();
  let isKeydownListenerBound = false;

  /**
   * Determine if the event target is inside an editable text area/input.
   * @param {EventTarget|null} target
   * @returns {boolean}
   */
  function isInteractiveInputField(target) {
    if (!target || !(target instanceof HTMLElement)) return false;

    const tagName = target.tagName ? target.tagName.toUpperCase() : "";
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return true;
    }

    if (target.isContentEditable || target.getAttribute("contenteditable") === "true") {
      return true;
    }

    if (typeof target.closest === "function" && target.closest('[contenteditable="true"]')) {
      return true;
    }

    return false;
  }

  /**
   * Global keydown handler.
   * @param {KeyboardEvent} event
   */
  function handleGlobalKeyDown(event) {
    // 1. Ignore if user is typing into input, textarea, or contenteditable
    if (isInteractiveInputField(event.target)) {
      return;
    }

    // 2. Ignore with modifier keys (Ctrl, Alt, Meta/Cmd)
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    const key = event.key;
    const normalizedKey = key === "?" || key === "Escape" ? key : key.toLowerCase();

    const handler = shortcutHandlers.get(normalizedKey) || shortcutHandlers.get(key);

    if (typeof handler === "function") {
      if (
        (normalizedKey === "?" || normalizedKey === "Escape" || event.code === "Space") &&
        typeof event.preventDefault === "function"
      ) {
        event.preventDefault();
      }
      handler(event);
    }
  }

  const shortcuts = {
    /**
     * Initialize keyboard shortcuts dispatcher.
     * @param {Record<string, (e: KeyboardEvent) => void>} handlers - Map of key handlers
     */
    init(handlers = {}) {
      this.clear();

      if (handlers && typeof handlers === "object") {
        Object.entries(handlers).forEach(([key, fn]) => {
          this.register(key, fn);
        });
      }

      if (!isKeydownListenerBound && typeof window !== "undefined") {
        window.addEventListener("keydown", handleGlobalKeyDown, true);
        isKeydownListenerBound = true;
      }

      return this;
    },

    /**
     * Register a single shortcut handler.
     * @param {string} key - Key identifier ('c', 'j', 'h', 's', '?', 'Escape')
     * @param {(e: KeyboardEvent) => void} handler - Callback function
     */
    register(key, handler) {
      if (!key || typeof handler !== "function") return;
      const normalizedKey = key === "?" || key === "Escape" ? key : key.toLowerCase();
      shortcutHandlers.set(normalizedKey, handler);
    },

    /**
     * Unregister a shortcut handler.
     * @param {string} key
     */
    unregister(key) {
      if (!key) return;
      const normalizedKey = key === "?" || key === "Escape" ? key : key.toLowerCase();
      shortcutHandlers.delete(normalizedKey);
    },

    /**
     * Remove all shortcut handlers.
     */
    clear() {
      shortcutHandlers.clear();
    },

    /**
     * Teardown global listener and unregister all handlers.
     */
    destroy() {
      this.clear();
      if (isKeydownListenerBound && typeof window !== "undefined") {
        window.removeEventListener("keydown", handleGlobalKeyDown, true);
        isKeydownListenerBound = false;
      }
    },
  };

  // =========================================================================
  // 5. NETWORK STATUS MONITOR & FLOATING OFFLINE BANNER
  // =========================================================================
  const BANNER_ID = "mrn-network-status-banner";
  const STYLES_ID = "mrn-ux-core-banner-styles";
  const networkListeners = new Set();
  let isNetworkInitialized = false;
  let onlineDismissTimeout = null;

  /**
   * Inject CSS styles for the floating network status banner.
   */
  function injectBannerStyles() {
    if (typeof document === "undefined" || document.getElementById(STYLES_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLES_ID;
    style.textContent = `
      #${BANNER_ID} {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(120%);
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        border-radius: 9999px;
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.4;
        box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
        z-index: 999999;
        transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        opacity: 0;
        pointer-events: none;
        max-width: 90vw;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
      }
      #${BANNER_ID}.mrn-visible {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
        pointer-events: auto;
      }
      #${BANNER_ID}.mrn-offline {
        background: rgba(26, 17, 23, 0.94);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.35);
      }
      #${BANNER_ID}.mrn-online {
        background: rgba(13, 30, 24, 0.94);
        color: #86efac;
        border: 1px solid rgba(34, 197, 94, 0.35);
      }
      #${BANNER_ID} .mrn-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      #${BANNER_ID}.mrn-offline .mrn-dot {
        background: #ef4444;
        box-shadow: 0 0 10px #ef4444;
        animation: mrn-pulse 2s infinite;
      }
      #${BANNER_ID}.mrn-online .mrn-dot {
        background: #22c55e;
        box-shadow: 0 0 10px #22c55e;
      }
      #${BANNER_ID} .mrn-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      @keyframes mrn-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }
      @media (max-width: 640px) {
        #${BANNER_ID} {
          bottom: 16px;
          padding: 10px 16px;
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create or fetch the floating offline/online banner element.
   * @returns {HTMLElement|null}
   */
  function getOrCreateBanner() {
    if (typeof document === "undefined") return null;

    injectBannerStyles();
    let banner = document.getElementById(BANNER_ID);

    if (!banner) {
      banner = document.createElement("div");
      banner.id = BANNER_ID;
      banner.setAttribute("role", "status");
      banner.setAttribute("aria-live", "polite");
      banner.innerHTML = `
        <span class="mrn-dot" aria-hidden="true"></span>
        <span class="mrn-text">You are currently offline. Changes will sync once reconnected.</span>
      `;
      document.body.appendChild(banner);
    }

    return banner;
  }

  const network = {
    /**
     * Check if network is currently connected.
     * @returns {boolean}
     */
    isOnline() {
      if (typeof navigator === "undefined" || !("onLine" in navigator)) {
        return true;
      }
      return navigator.onLine;
    },

    /**
     * Show the floating offline banner.
     * @param {string} [customMessage]
     */
    showOfflineBanner(customMessage) {
      if (onlineDismissTimeout) {
        clearTimeout(onlineDismissTimeout);
        onlineDismissTimeout = null;
      }

      const banner = getOrCreateBanner();
      if (!banner) return;

      const textEl = banner.querySelector(".mrn-text");
      if (textEl) {
        textEl.textContent =
          customMessage || "You are currently offline. Routine check-ins will sync automatically.";
      }

      banner.classList.remove("mrn-online");
      banner.classList.add("mrn-offline", "mrn-visible");
    },

    /**
     * Show temporary "back online" feedback and smoothly dismiss.
     * @param {string} [customMessage]
     */
    showOnlineBanner(customMessage) {
      if (onlineDismissTimeout) {
        clearTimeout(onlineDismissTimeout);
      }

      const banner = getOrCreateBanner();
      if (!banner) return;

      const textEl = banner.querySelector(".mrn-text");
      if (textEl) {
        textEl.textContent = customMessage || "Connection restored. Syncing your habits...";
      }

      banner.classList.remove("mrn-offline");
      banner.classList.add("mrn-online", "mrn-visible");

      // Smoothly hide after 3.2 seconds
      onlineDismissTimeout = setTimeout(() => {
        this.hideBanner();
        onlineDismissTimeout = null;
      }, 3200);
    },

    /**
     * Hide the status banner.
     */
    hideBanner() {
      const banner = typeof document !== "undefined" ? document.getElementById(BANNER_ID) : null;
      if (banner) {
        banner.classList.remove("mrn-visible");
      }
    },

    /**
     * Add a listener for online/offline events.
     * @param {(isOnline: boolean) => void} callback
     */
    addListener(callback) {
      if (typeof callback === "function") {
        networkListeners.add(callback);
      }
    },

    /**
     * Remove a network status listener.
     * @param {(isOnline: boolean) => void} callback
     */
    removeListener(callback) {
      networkListeners.delete(callback);
    },

    /**
     * Initialize network monitoring and DOM listeners.
     */
    init() {
      if (isNetworkInitialized || typeof window === "undefined") return this;

      const handleOnline = () => {
        this.showOnlineBanner();
        networkListeners.forEach((cb) => cb(true));
      };

      const handleOffline = () => {
        this.showOfflineBanner();
        networkListeners.forEach((cb) => cb(false));
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Check initial state
      if (!this.isOnline()) {
        this.showOfflineBanner();
      }

      isNetworkInitialized = true;
      return this;
    },
  };

  // =========================================================================
  // 6. MAIN UXCORE FACADE & INITIALIZER
  // =========================================================================
  const UXCore = {
    cache,
    haptics,
    sound,
    shortcuts,
    network,

    /**
     * Optional all-in-one initializer.
     * @param {Object} [options]
     * @param {Record<string, Function>} [options.shortcuts] - Keyboard handlers
     * @param {boolean} [options.initNetwork=true] - Auto-start network monitor
     */
    init(options = {}) {
      if (options.shortcuts) {
        this.shortcuts.init(options.shortcuts);
      }
      if (options.initNetwork !== false) {
        this.network.init();
      }
      return this;
    },
  };

  // Automatically start network monitor on DOMContentLoaded in browser environments
  if (typeof window !== "undefined") {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      network.init();
    } else {
      window.addEventListener("DOMContentLoaded", () => network.init());
    }
  }

  // Export to global scope
  if (typeof global !== "undefined") {
    global.UXCore = UXCore;
  }

  // CommonJS export support for tests & Node.js
  if (typeof module !== "undefined" && module.exports) {
    module.exports = UXCore;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
