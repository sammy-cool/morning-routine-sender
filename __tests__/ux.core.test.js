/**
 * Test Suite: UX Core & Haptics Subsystem
 * File: __tests__/ux.core.test.js
 */

describe("UX Core Engine (public/js/ux-core.js)", () => {
  let UXCore;
  let listeners;
  let storageMap;

  beforeEach(() => {
    jest.resetModules();
    listeners = new Map();
    storageMap = new Map();

    global.localStorage = {
      getItem: jest.fn((k) => storageMap.get(k) || null),
      setItem: jest.fn((k, v) => storageMap.set(k, String(v))),
      removeItem: jest.fn((k) => storageMap.delete(k)),
      clear: jest.fn(() => storageMap.clear()),
      key: jest.fn((i) => Array.from(storageMap.keys())[i]),
      get length() {
        return storageMap.size;
      },
    };

    global.window = {
      addEventListener: jest.fn((event, handler) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(handler);
      }),
      removeEventListener: jest.fn((event, handler) => {
        if (listeners.has(event)) {
          const list = listeners.get(event).filter((h) => h !== handler);
          listeners.set(event, list);
        }
      }),
      dispatchEvent: jest.fn((event) => {
        const list = listeners.get(event.type) || [];
        list.forEach((h) => h(event));
        return true;
      }),
    };

    global.document = {
      readyState: "complete",
      getElementById: jest.fn(() => null),
      createElement: jest.fn(() => {
        const el = {
          id: "",
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(() => false),
          },
          setAttribute: jest.fn(),
          appendChild: jest.fn(),
          querySelector: jest.fn(() => ({ textContent: "" })),
          innerHTML: "",
          tagName: "DIV",
        };
        return el;
      }),
      head: { appendChild: jest.fn() },
      body: { appendChild: jest.fn() },
    };

    global.navigator = {
      onLine: true,
    };

    UXCore = require("../public/js/ux-core");
    UXCore.cache.clear();
    UXCore.shortcuts.clear();
  });

  afterEach(() => {
    UXCore.shortcuts.destroy();
    jest.restoreAllMocks();
  });

  describe("1. SWR (Stale-While-Revalidate) Cache Engine", () => {
    test("sets and retrieves cached data synchronously", () => {
      const payload = { streak: 12, name: "Marcus" };
      UXCore.cache.set("profile_key", payload);

      const entry = UXCore.cache.get("profile_key");
      expect(entry).not.toBeNull();
      expect(entry.data).toEqual(payload);
      expect(entry.isStale).toBe(false);
      expect(typeof entry.timestamp).toBe("number");
      expect(entry.age).toBeGreaterThanOrEqual(0);
    });

    test("correctly calculates staleness based on maxAgeMs", () => {
      const payload = { active: true };
      const oldEntry = {
        data: payload,
        timestamp: Date.now() - 70000,
      };
      storageMap.set("mrn_swr_cache_status_key", JSON.stringify(oldEntry));

      const res = UXCore.cache.get("status_key", 60000);
      expect(res).not.toBeNull();
      expect(res.data).toEqual(payload);
      expect(res.isStale).toBe(true);
    });

    test("invalidates individual keys and clears full cache", () => {
      UXCore.cache.set("item_1", { a: 1 });
      UXCore.cache.set("item_2", { b: 2 });

      expect(UXCore.cache.has("item_1")).toBe(true);
      expect(UXCore.cache.has("item_2")).toBe(true);

      UXCore.cache.invalidate("item_1");
      expect(UXCore.cache.has("item_1")).toBe(false);
      expect(UXCore.cache.has("item_2")).toBe(true);

      UXCore.cache.clear();
      expect(UXCore.cache.has("item_2")).toBe(false);
    });
  });

  describe("2. Mobile Haptic Feedback Engine", () => {
    test("handles unsupported vibration environments gracefully without errors", () => {
      delete global.navigator.vibrate;
      expect(UXCore.haptics.isSupported()).toBe(false);
      expect(UXCore.haptics.light()).toBe(false);
      expect(UXCore.haptics.success()).toBe(false);
      expect(UXCore.haptics.celebration()).toBe(false);
    });

    test("dispatches vibration patterns when navigator.vibrate is supported", () => {
      global.navigator.vibrate = jest.fn().mockReturnValue(true);

      expect(UXCore.haptics.isSupported()).toBe(true);

      UXCore.haptics.light();
      expect(global.navigator.vibrate).toHaveBeenCalledWith(15);

      UXCore.haptics.success();
      expect(global.navigator.vibrate).toHaveBeenCalledWith([20, 40, 20]);

      UXCore.haptics.celebration();
      expect(global.navigator.vibrate).toHaveBeenCalledWith([30, 50, 30, 50, 80]);
    });
  });

  describe("3. Procedural Web Audio Synthesis Engine", () => {
    test("toggles and persists mute state in localStorage", () => {
      expect(UXCore.sound.isMuted()).toBe(false);

      const state1 = UXCore.sound.toggleMute();
      expect(state1).toBe(true);
      expect(UXCore.sound.isMuted()).toBe(true);
      expect(global.localStorage.getItem("mrn_ux_sound_muted")).toBe("true");

      const state2 = UXCore.sound.toggleMute(false);
      expect(state2).toBe(false);
      expect(UXCore.sound.isMuted()).toBe(false);
      expect(global.localStorage.getItem("mrn_ux_sound_muted")).toBe("false");
    });

    test("suppresses audio when sound is muted", () => {
      UXCore.sound.toggleMute(true);
      expect(UXCore.sound.playSuccess()).toBe(false);
      expect(UXCore.sound.playMilestone()).toBe(false);
    });
  });

  describe("4. Keyboard Shortcuts Dispatcher", () => {
    test("registers shortcuts and dispatches callbacks on keydown", () => {
      const checkinSpy = jest.fn();
      const journalSpy = jest.fn();
      const heatmapSpy = jest.fn();
      const shortcutsModalSpy = jest.fn();
      const escSpy = jest.fn();

      UXCore.shortcuts.init({
        c: checkinSpy,
        j: journalSpy,
        h: heatmapSpy,
        "?": shortcutsModalSpy,
        Escape: escSpy,
      });

      // Dispatch 'c'
      global.window.dispatchEvent({ type: "keydown", key: "c" });
      expect(checkinSpy).toHaveBeenCalledTimes(1);

      // Dispatch 'j'
      global.window.dispatchEvent({ type: "keydown", key: "j" });
      expect(journalSpy).toHaveBeenCalledTimes(1);

      // Dispatch 'h'
      global.window.dispatchEvent({ type: "keydown", key: "h" });
      expect(heatmapSpy).toHaveBeenCalledTimes(1);

      // Dispatch '?'
      global.window.dispatchEvent({ type: "keydown", key: "?" });
      expect(shortcutsModalSpy).toHaveBeenCalledTimes(1);

      // Dispatch 'Escape'
      global.window.dispatchEvent({ type: "keydown", key: "Escape" });
      expect(escSpy).toHaveBeenCalledTimes(1);
    });

    test("ignores shortcuts when modifier keys (Ctrl, Alt, Meta) are held", () => {
      const checkinSpy = jest.fn();
      UXCore.shortcuts.init({ c: checkinSpy });

      global.window.dispatchEvent({ type: "keydown", key: "c", ctrlKey: true });
      global.window.dispatchEvent({ type: "keydown", key: "c", altKey: true });
      global.window.dispatchEvent({ type: "keydown", key: "c", metaKey: true });

      expect(checkinSpy).not.toHaveBeenCalled();
    });
  });

  describe("5. Real-Time Network Monitor", () => {
    test("correctly reports isOnline and triggers listeners on online/offline events", () => {
      UXCore.network.init();

      const listener = jest.fn();
      UXCore.network.addListener(listener);

      global.window.dispatchEvent({ type: "offline" });
      expect(listener).toHaveBeenCalledWith(false);

      global.window.dispatchEvent({ type: "online" });
      expect(listener).toHaveBeenCalledWith(true);

      UXCore.network.removeListener(listener);
    });
  });
});
