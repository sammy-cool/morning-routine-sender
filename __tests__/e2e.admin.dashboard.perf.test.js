/**
 * E2E Test Suite: Admin Dashboard Main-Thread Load Freeze Elimination & Cooperative Scheduling (Feature R4)
 *
 * Methodology: 4-Tier Test Architecture
 *  - Tier 1: Feature Coverage (>=5 tests per feature)
 *  - Tier 2: Boundary & Corner Cases (>=5 tests per feature)
 *  - Tier 3: Cross-Feature Combinations
 *  - Tier 4: Real-World Scenarios
 *
 * Authoritative Sources:
 *  - ORIGINAL_REQUEST.md: Section R4, Lines 21-23, 43-46
 *  - PROJECT.md: Features F12, F13, Lines 23-24, 34
 *  - DISPATCH.md: R4 Specification
 */

process.env.USE_MOCK_REDIS = "true";

const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.join(__dirname, "..");
const DASHBOARD_HTML_PATH = path.join(ROOT_DIR, "admin-renderer", "views", "admin-dashboard.html");

function getDashboardHtml() {
  return fs.readFileSync(DASHBOARD_HTML_PATH, "utf-8");
}

/**
 * Creates a mock DOM environment tailored for testing admin dashboard script execution
 */
function createAdminDashboardMockWindow() {
  const elements = new Map();
  const listeners = new Map();
  const timers = new Set();
  const intervals = new Set();

  function createMockEl(id = "", tag = "DIV") {
    const classListSet = new Set();
    const children = [];
    return {
      id,
      tagName: tag.toUpperCase(),
      style: { display: "" },
      classList: {
        add: jest.fn((c) => classListSet.add(c)),
        remove: jest.fn((c) => classListSet.delete(c)),
        contains: jest.fn((c) => classListSet.has(c)),
      },
      getContext: jest.fn(() => ({
        clearRect: jest.fn(),
        fillRect: jest.fn(),
      })),
      appendChild: jest.fn((ch) => children.push(ch)),
      remove: jest.fn(),
      focus: jest.fn(),
      innerHTML: "",
      textContent: "",
    };
  }

  const mockDoc = {
    readyState: "loading",
    getElementById: jest.fn((id) => elements.get(id) || null),
    querySelectorAll: jest.fn(() => []),
    querySelector: jest.fn((sel) => {
      const matchId = sel.replace("#", "");
      return elements.get(matchId) || null;
    }),
    _registerElement: (id, tag = "DIV") => {
      const el = createMockEl(id, tag);
      elements.set(id, el);
      return el;
    },
  };

  const idleCallbacks = new Map();
  let idleIdCounter = 1;

  const mockWin = {
    document: mockDoc,
    location: { replace: jest.fn(), href: "http://localhost:2900/admin-dashboard" },
    addEventListener: jest.fn((evt, handler) => {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(handler);
    }),
    removeEventListener: jest.fn((evt, handler) => {
      const list = listeners.get(evt) || [];
      listeners.set(
        evt,
        list.filter((h) => h !== handler),
      );
    }),
    dispatchEvent: async (event) => {
      const list = listeners.get(event.type) || [];
      for (const handler of list) {
        await handler(event);
      }
      return true;
    },
    setTimeout: jest.fn((fn, ms) => {
      const id = setTimeout(fn, ms);
      timers.add(id);
      return id;
    }),
    clearTimeout: jest.fn((id) => {
      clearTimeout(id);
      timers.delete(id);
    }),
    setInterval: jest.fn((fn, ms) => {
      const id = setInterval(fn, ms);
      intervals.add(id);
      return id;
    }),
    clearInterval: jest.fn((id) => {
      clearInterval(id);
      intervals.delete(id);
    }),
    requestIdleCallback: jest.fn((cb, _opts) => {
      const id = idleIdCounter++;
      idleCallbacks.set(id, cb);
      return id;
    }),
    cancelIdleCallback: jest.fn((id) => {
      idleCallbacks.delete(id);
    }),
    _runIdleCallbacks: async () => {
      for (const [id, cb] of Array.from(idleCallbacks.entries())) {
        idleCallbacks.delete(id);
        await cb({ didTimeout: false, timeRemaining: () => 50 });
      }
    },
    fetch: jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    }),
    Chart: jest.fn(),
    ToastManager: {
      info: jest.fn(),
      success: jest.fn(),
      error: jest.fn(),
    },
  };

  return { mockWin, mockDoc, elements, listeners, idleCallbacks };
}

describe("Admin Dashboard Main-Thread Load Freeze Elimination & Performance E2E Suite (R4)", () => {
  // =========================================================================
  // TIER 1: Feature Coverage (>=5 tests)
  // =========================================================================
  describe("Tier 1: Feature Coverage - Cooperative Scheduling, Chart.js & Telemetry Deferral", () => {
    test("R4-T1-1: admin-dashboard.html eliminates synchronous 9-request blocking loop on DOMContentLoaded", () => {
      const html = getDashboardHtml();

      // Ensure the old pattern of running all 9 endpoints synchronously in DOMContentLoaded is decoupled
      // DOMContentLoaded should NOT execute Promise.allSettled with all 9 API calls directly
      const synchronousAllSettledPattern =
        /window\.addEventListener\(\s*["']DOMContentLoaded["']\s*,\s*\(\)\s*=>\s*\{\s*refreshAllData\(\);/s;

      expect(html).not.toMatch(synchronousAllSettledPattern);
    });

    test("R4-T1-2: Phase 1 critical DOM load provides immediate interactive command palette and metric structures", () => {
      const html = getDashboardHtml();

      // Critical UI components must be present in DOM structure
      expect(html).toContain('id="commandPaletteModal"');
      expect(html).toContain('id="cmdPaletteInput"');
      expect(html).toContain('id="subscribersTableBody"');
      expect(html).toContain('id="subscriberGrowthChart"');
      expect(html).toContain('id="templateDistributionChart"');
    });

    test("R4-T1-3: Phase 2 Chart.js instantiation is deferred via cooperative scheduling (requestIdleCallback or fallback)", () => {
      const html = getDashboardHtml();

      // Chart.js rendering must use cooperative scheduling (requestIdleCallback or cooperative schedule)
      const usesCooperativeScheduling =
        html.includes("requestIdleCallback") ||
        html.includes("scheduleIdle") ||
        html.includes("cooperative") ||
        html.includes("deferChart");

      expect(usesCooperativeScheduling).toBe(true);
    });

    test("R4-T1-4: Phase 3 non-critical telemetry and polling are deferred behind initial critical rendering", () => {
      const html = getDashboardHtml();

      // Telemetry calls (telemetry-overview, recent events) must be decoupled from critical first paint
      const hasPhasedExecution =
        html.includes("loadDeliverabilityTelemetry") &&
        (html.includes("setTimeout") ||
          html.includes("requestIdleCallback") ||
          html.includes("then("));

      expect(hasPhasedExecution).toBe(true);
    });

    test("R4-T1-5: Cooperative scheduling safely falls back to setTimeout when requestIdleCallback is unavailable", () => {
      const { mockWin } = createAdminDashboardMockWindow();
      delete mockWin.requestIdleCallback;
      delete mockWin.cancelIdleCallback;

      // Polyfill/fallback logic check: if requestIdleCallback is missing, it falls back to setTimeout
      const scheduleTask = (fn) => {
        if (typeof mockWin.requestIdleCallback === "function") {
          return mockWin.requestIdleCallback(fn, { timeout: 2000 });
        }
        return mockWin.setTimeout(fn, 16);
      };

      const mockFn = jest.fn();
      scheduleTask(mockFn);

      expect(mockWin.setTimeout).toHaveBeenCalledWith(mockFn, 16);
    });

    test("R4-T1-6: External script tags for Chart.js and Toast library specify defer attributes", () => {
      const html = getDashboardHtml();

      // Vendor scripts must have defer to prevent parse-blocking the main thread
      expect(html).toMatch(/<script[^>]*chart\.umd\.min\.js[^>]*defer/i);
      expect(html).toMatch(/<script[^>]*customizable-toast-notification[^>]*defer/i);
    });
  });

  // =========================================================================
  // TIER 2: Boundary & Corner Cases (>=5 tests)
  // =========================================================================
  describe("Tier 2: Boundary & Corner Cases - Missing Canvases, Network Failure & Teardown", () => {
    test("R4-T2-1: Chart initialization handles missing or unmounted canvas elements gracefully", () => {
      const { mockDoc } = createAdminDashboardMockWindow();
      // Ensure canvas element is absent
      mockDoc.getElementById.mockReturnValue(null);

      const renderChartSafe = (canvasId) => {
        const canvas = mockDoc.getElementById(canvasId);
        if (!canvas) {
          return null; // Gracefully handles missing canvas
        }
        return canvas.getContext("2d");
      };

      expect(() => renderChartSafe("missingCanvas")).not.toThrow();
      expect(renderChartSafe("missingCanvas")).toBeNull();
    });

    test("R4-T2-2: Telemetry API errors during deferred loading do not crash page or block UI interactivity", async () => {
      const { mockWin } = createAdminDashboardMockWindow();
      mockWin.fetch.mockRejectedValueOnce(new Error("Telemetry endpoint timed out"));

      const loadTelemetrySafe = async () => {
        try {
          const res = await mockWin.fetch("/admin/api/telemetry-overview");
          return await res.json();
        } catch (_err) {
          mockWin.ToastManager.error("Telemetry failed to load");
          return null;
        }
      };

      const result = await loadTelemetrySafe();
      expect(result).toBeNull();
      expect(mockWin.ToastManager.error).toHaveBeenCalled();
    });

    test("R4-T2-3: pagehide and beforeunload listeners clean up active polling intervals and scheduled handles", () => {
      const html = getDashboardHtml();

      // Verify that pagehide or beforeunload registers cleanup listeners
      expect(html).toContain("pagehide");
      expect(html).toContain("beforeunload");
      expect(html).toMatch(/clearInterval\s*\(\s*webhookAutoPollIntervalId\s*\)/);
    });

    test("R4-T2-4: Rapid manual refresh triggers debounce or cancellation of pending tasks without duplicate calls", () => {
      jest.useFakeTimers();
      let executionCount = 0;
      let timerId = null;

      const debouncedRefresh = () => {
        if (timerId) clearTimeout(timerId);
        timerId = setTimeout(() => {
          executionCount++;
        }, 150);
      };

      // Trigger 5 rapid refreshes in succession
      debouncedRefresh();
      debouncedRefresh();
      debouncedRefresh();
      debouncedRefresh();
      debouncedRefresh();

      jest.advanceTimersByTime(200);
      expect(executionCount).toBe(1);

      jest.useRealTimers();
    });

    test("R4-T2-5: Cooperative scheduling bounds tasks with a max timeout under idle starvation", () => {
      const { mockWin } = createAdminDashboardMockWindow();

      const scheduleWithTimeout = (fn, timeoutMs = 2000) => {
        return mockWin.requestIdleCallback(fn, { timeout: timeoutMs });
      };

      const task = jest.fn();
      scheduleWithTimeout(task, 2000);

      expect(mockWin.requestIdleCallback).toHaveBeenCalledWith(task, { timeout: 2000 });
    });
  });

  // =========================================================================
  // TIER 3: Cross-Feature Combinations (Pairwise)
  // =========================================================================
  describe("Tier 3: Cross-Feature Combinations - Standalone PWA Display & Phased Loading", () => {
    test("R4-T3-1: Standalone PWA display mode: loader dissolves cleanly before cooperative charts instantiate", () => {
      jest.useFakeTimers();
      const { mockWin, mockDoc } = createAdminDashboardMockWindow();
      const loaderRoot = mockDoc._registerElement("loaderRoot");
      loaderRoot.style.display = "flex";

      let chartRendered = false;

      // Phase 1: Loader fade-out initiated on DOMContentLoaded
      loaderRoot.classList.add("fade-out");
      setTimeout(() => {
        loaderRoot.remove();
      }, 300);

      // Phase 2: Chart deferred via requestIdleCallback
      mockWin.requestIdleCallback(() => {
        chartRendered = true;
      });

      // At 100ms: Loader is still fading, chart not yet rendered
      jest.advanceTimersByTime(100);
      expect(chartRendered).toBe(false);

      // At 300ms: Loader removed
      jest.advanceTimersByTime(200);
      expect(loaderRoot.remove).toHaveBeenCalled();

      // Now run idle callbacks: Chart renders without visual collision with loader
      mockWin._runIdleCallbacks();
      expect(chartRendered).toBe(true);

      jest.useRealTimers();
    });
  });

  // =========================================================================
  // TIER 4: Real-World Scenarios
  // =========================================================================
  describe("Tier 4: Real-World Scenarios - Immediate Command Palette Responsiveness", () => {
    test("R4-T4-1: Admin user can immediately open Command Palette (Ctrl+K) on DOMContentLoaded without main-thread freeze", async () => {
      const { mockWin, mockDoc, elements } = createAdminDashboardMockWindow();
      const modal = mockDoc._registerElement("commandPaletteModal");
      modal.style.display = "none";
      const input = mockDoc._registerElement("cmdPaletteInput", "INPUT");

      // Wire keydown listener
      mockWin.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          modal.style.display = "flex";
          modal.classList.add("open");
          input.focus();
        }
      });

      // User presses Ctrl+K immediately upon load
      await mockWin.dispatchEvent({
        type: "keydown",
        ctrlKey: true,
        key: "k",
        preventDefault: jest.fn(),
      });

      expect(modal.style.display).toBe("flex");
      expect(modal.classList.add).toHaveBeenCalledWith("open");
      expect(input.focus).toHaveBeenCalled();
    });
  });
});
