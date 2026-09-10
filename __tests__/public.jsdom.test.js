/**
 * Test Suite: Frontend Client Scripts Execution
 * Verifies:
 *   - public/js/landing-page-modal.js
 *   - public/js/skeleton-loader.js
 *   - public/js/pwa-install.js
 *   - public/js/subscriber-login.js
 *   - public/js/subscriber-signup.js
 */

const fs = require("fs");
const path = require("path");

function evaluateScript(relPath, contextWindow) {
  const fullPath = path.join(__dirname, "..", relPath);
  const code = fs.readFileSync(fullPath, "utf-8");
  const scriptFn = new Function(
    "window",
    "document",
    "globalThis",
    "localStorage",
    "navigator",
    "fetch",
    code,
  );
  scriptFn(
    contextWindow,
    contextWindow.document,
    contextWindow,
    contextWindow.localStorage,
    contextWindow.navigator,
    contextWindow.fetch,
  );
}

describe("Frontend Client Script Interactions", () => {
  let mockWindow;
  let mockDocument;
  let storageMap;
  let listeners;

  beforeEach(() => {
    jest.useFakeTimers();
    storageMap = new Map();
    listeners = new Map();

    const createMockElement = (id = "", tagName = "DIV") => {
      const classListSet = new Set();
      const attrs = new Map();
      const el = {
        id,
        tagName: tagName.toUpperCase(),
        style: {
          display: "",
          setProperty: jest.fn(),
        },
        inert: false,
        disabled: false,
        value: "",
        textContent: "",
        innerHTML: "",
        children: [],
        classList: {
          add: jest.fn((c) => classListSet.add(c)),
          remove: jest.fn((c) => classListSet.delete(c)),
          contains: jest.fn((c) => classListSet.has(c)),
        },
        setAttribute: jest.fn((k, v) => attrs.set(k, String(v))),
        getAttribute: jest.fn((k) => attrs.get(k) || null),
        removeAttribute: jest.fn((k) => attrs.delete(k)),
        focus: jest.fn(() => {
          mockDocument.activeElement = el;
        }),
        blur: jest.fn(() => {
          if (mockDocument.activeElement === el) mockDocument.activeElement = null;
        }),
        appendChild: jest.fn((child) => {
          el.children.push(child);
          return child;
        }),
        remove: jest.fn(),
        contains: jest.fn((child) => el === child || el.children.includes(child)),
        addEventListener: jest.fn((evt, handler) => {
          if (!el._handlers) el._handlers = new Map();
          if (!el._handlers.has(evt)) el._handlers.set(evt, []);
          el._handlers.get(evt).push(handler);
        }),
        dispatchEvent: async (evt) => {
          if (!el._handlers || !el._handlers.has(evt.type)) return true;
          const handlers = el._handlers.get(evt.type);
          for (const fn of handlers) {
            await fn(evt);
          }
          return true;
        },
      };
      return el;
    };

    const elementsById = new Map();

    mockDocument = {
      readyState: "complete",
      activeElement: null,
      getElementById: jest.fn((id) => elementsById.get(id) || null),
      createElement: jest.fn((tag) => createMockElement("", tag)),
      _registerElement: (id, tag = "DIV") => {
        const el = createMockElement(id, tag);
        elementsById.set(id, el);
        return el;
      },
    };

    mockWindow = {
      document: mockDocument,
      location: { href: "http://localhost:2900/" },
      navigator: {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        standalone: false,
      },
      matchMedia: jest.fn(() => ({ matches: false })),
      localStorage: {
        getItem: jest.fn((k) => storageMap.get(k) || null),
        setItem: jest.fn((k, v) => storageMap.set(k, String(v))),
        removeItem: jest.fn((k) => storageMap.delete(k)),
      },
      addEventListener: jest.fn((event, handler) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(handler);
      }),
      dispatchEvent: async (event) => {
        const list = listeners.get(event.type) || [];
        for (const h of list) {
          await h(event);
        }
        return true;
      },
      fetch: jest.fn(),
      UXCore: {
        toast: {
          show: jest.fn(),
        },
      },
      customizableToast: {
        createToast: jest.fn(),
      },
      ToastManager: {
        show: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // 1. Landing Page Modal Tests
  // ==========================================================================
  describe("Landing Page Admin Modal (public/js/landing-page-modal.js)", () => {
    let keyModal, openModalBtn, cancelBtn, submitBtn, adminKey;
    let toggleGenerate, generateSection, adminSecret, generateBtn;

    beforeEach(async () => {
      keyModal = mockDocument._registerElement("keyModal");
      openModalBtn = mockDocument._registerElement("openModalBtn", "BUTTON");
      cancelBtn = mockDocument._registerElement("cancelBtn", "BUTTON");
      submitBtn = mockDocument._registerElement("submitBtn", "BUTTON");
      adminKey = mockDocument._registerElement("adminKey", "INPUT");
      toggleGenerate = mockDocument._registerElement("toggleGenerate", "A");
      generateSection = mockDocument._registerElement("generateSection");
      generateSection.style.display = "none";
      adminSecret = mockDocument._registerElement("adminSecret", "INPUT");
      generateBtn = mockDocument._registerElement("generateBtn", "BUTTON");
      mockDocument._registerElement("generateStatus", "SPAN");

      evaluateScript("public/js/landing-page-modal.js", mockWindow);
      await mockWindow.dispatchEvent({ type: "DOMContentLoaded" });
    });

    test("opens modal and sets aria/inert attributes when open button is clicked", async () => {
      await openModalBtn.dispatchEvent({ type: "click", preventDefault: jest.fn() });

      expect(keyModal.inert).toBe(false);
      expect(keyModal.style.display).toBe("flex");
      expect(keyModal.classList.add).toHaveBeenCalledWith("open");
      expect(keyModal.removeAttribute).toHaveBeenCalledWith("aria-hidden");
      expect(openModalBtn.setAttribute).toHaveBeenCalledWith("aria-expanded", "true");
      expect(mockDocument.activeElement).toBe(adminKey);
    });

    test("closes modal and restores state when cancel button is clicked", async () => {
      await openModalBtn.dispatchEvent({ type: "click", preventDefault: jest.fn() });
      await cancelBtn.dispatchEvent({ type: "click" });

      expect(keyModal.classList.remove).toHaveBeenCalledWith("open");
      expect(keyModal.setAttribute).toHaveBeenCalledWith("aria-hidden", "true");
      expect(keyModal.inert).toBe(true);
      expect(keyModal.style.display).toBe("none");
      expect(openModalBtn.setAttribute).toHaveBeenCalledWith("aria-expanded", "false");
      expect(adminKey.value).toBe("");
    });

    test("closes modal on Escape key press", async () => {
      await openModalBtn.dispatchEvent({ type: "click", preventDefault: jest.fn() });
      keyModal.classList.contains = jest.fn((c) => c === "open");

      await mockWindow.dispatchEvent({ type: "keydown", key: "Escape" });

      expect(keyModal.setAttribute).toHaveBeenCalledWith("aria-hidden", "true");
      expect(keyModal.inert).toBe(true);
    });

    test("submits key to /verify-admin-key and redirects on admin role", async () => {
      adminKey.value = "valid-secret-key-123";
      mockWindow.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ role: "admin" }),
      });

      await submitBtn.dispatchEvent({ type: "click" });

      expect(mockWindow.fetch).toHaveBeenCalledWith("/verify-admin-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "valid-secret-key-123" }),
      });
      expect(mockWindow.location.href).toBe("/admin-dashboard");
    });

    test("falls back to customizableToast when UXCore is absent", async () => {
      delete mockWindow.UXCore;
      adminKey.value = "wrong-key";
      mockWindow.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ role: "user" }),
      });

      await submitBtn.dispatchEvent({ type: "click" });

      expect(mockWindow.customizableToast.createToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "warning",
          message: expect.stringContaining("Key not recognized"),
        }),
      );
    });

    test("toggles generateSection open and closed", async () => {
      generateSection.style.display = "none";
      await toggleGenerate.dispatchEvent({ type: "click", preventDefault: jest.fn() });
      expect(generateSection.style.display).toBe("block");

      await toggleGenerate.dispatchEvent({ type: "click", preventDefault: jest.fn() });
      expect(generateSection.style.display).toBe("none");
    });

    test("generates key using admin secret", async () => {
      adminSecret.value = "my-admin-master-secret";
      mockWindow.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ key: "generated-hex-key" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ role: "admin" }),
        });

      await generateBtn.dispatchEvent({ type: "click" });

      expect(mockWindow.fetch).toHaveBeenCalledWith("/generate-admin-key", {
        headers: { "x-admin-secret": "my-admin-master-secret" },
      });
      expect(adminKey.value).toBe("generated-hex-key");
      expect(mockWindow.location.href).toBe("/admin-dashboard");
    });
  });

  // ==========================================================================
  // 2. Skeleton Loader Tests
  // ==========================================================================
  describe("Skeleton Loader (public/js/skeleton-loader.js)", () => {
    let loader, skeletonContainer, loaderRoot, mainRoot, logoBox;

    beforeEach(() => {
      loader = mockDocument._registerElement("loader");
      skeletonContainer = mockDocument._registerElement("skeletonContainer");
      loaderRoot = mockDocument._registerElement("loaderRoot");
      mainRoot = mockDocument._registerElement("mainRoot");
      mainRoot.style.display = "none";
      logoBox = mockDocument._registerElement("logoBox");

      evaluateScript("public/js/skeleton-loader.js", mockWindow);
    });

    test("generates particles and applies fade-out on DOMContentLoaded", async () => {
      await mockWindow.dispatchEvent({ type: "DOMContentLoaded" });

      expect(logoBox.appendChild).toHaveBeenCalledTimes(20);
      expect(loader.classList.add).toHaveBeenCalledWith("fade-out");
      expect(skeletonContainer.classList.add).toHaveBeenCalledWith("fade-out");
      expect(loaderRoot.classList.add).toHaveBeenCalledWith("fade-out");
    });

    test("removes skeleton and unhides mainRoot after 300ms transition", async () => {
      await mockWindow.dispatchEvent({ type: "DOMContentLoaded" });

      expect(mainRoot.style.display).toBe("none");
      jest.advanceTimersByTime(300);

      expect(loader.remove).toHaveBeenCalled();
      expect(skeletonContainer.remove).toHaveBeenCalled();
      expect(loaderRoot.remove).toHaveBeenCalled();
      expect(mainRoot.style.display).toBe("block");
    });
  });

  // ==========================================================================
  // 3. PWA Install Banner & Lifecycle Tests
  // ==========================================================================
  describe("PWA Install Engine (public/js/pwa-install.js)", () => {
    let banner, bannerDismissBtn, navInstallBtn;

    beforeEach(async () => {
      banner = mockDocument._registerElement("pwaInstallBanner");
      banner.style.display = "none";
      mockDocument._registerElement("pwaBannerInstallBtn", "BUTTON");
      bannerDismissBtn = mockDocument._registerElement("pwaBannerDismissBtn", "BUTTON");
      navInstallBtn = mockDocument._registerElement("pwaNavInstallBtn", "BUTTON");

      evaluateScript("public/js/pwa-install.js", mockWindow);
      await mockWindow.dispatchEvent({ type: "DOMContentLoaded" });
    });

    test("ignores prompt and hides elements if app is already running standalone", async () => {
      mockWindow.matchMedia.mockReturnValue({ matches: true });
      await mockWindow.dispatchEvent({ type: "DOMContentLoaded" });

      expect(banner.style.display).toBe("none");
      expect(navInstallBtn.style.display).toBe("none");
    });

    test("reveals install banner on beforeinstallprompt event after delay", async () => {
      const promptEvent = {
        type: "beforeinstallprompt",
        preventDefault: jest.fn(),
        prompt: jest.fn(),
        userChoice: Promise.resolve({ outcome: "accepted" }),
      };

      await mockWindow.dispatchEvent(promptEvent);
      expect(promptEvent.preventDefault).toHaveBeenCalled();

      expect(banner.style.display).toBe("none");
      jest.advanceTimersByTime(1200);

      expect(banner.style.display).toBe("flex");
    });

    test("records dismissal timestamp to localStorage and hides banner on dismiss", async () => {
      await bannerDismissBtn.dispatchEvent({ type: "click" });

      expect(banner.classList.remove).toHaveBeenCalledWith("visible");
      jest.advanceTimersByTime(300);
      expect(banner.style.display).toBe("none");
      expect(mockWindow.localStorage.setItem).toHaveBeenCalledWith(
        "mrn_pwa_install_dismissed",
        expect.any(String),
      );
    });

    test("handles appinstalled event with celebration toast", async () => {
      await mockWindow.dispatchEvent({ type: "appinstalled" });

      expect(mockWindow.UXCore.toast.show).toHaveBeenCalledWith(
        expect.stringContaining("installed successfully"),
        "success",
        expect.any(Object),
      );
      expect(banner.style.display).toBe("none");
    });
  });

  // ==========================================================================
  // 4. Subscriber Login & Signup (Honeypot, Validation, Toasts)
  // ==========================================================================
  describe("Subscriber Login & Signup Forms", () => {
    describe("Login Form (public/js/subscriber-login.js)", () => {
      let form, emailInput, submitBtn, statusEl;

      beforeEach(async () => {
        form = mockDocument._registerElement("subscriberLoginForm", "FORM");
        emailInput = mockDocument._registerElement("subscriberLoginEmail", "INPUT");
        submitBtn = mockDocument._registerElement("subscriberLoginBtn", "BUTTON");
        statusEl = mockDocument._registerElement("subscriberLoginStatus", "DIV");
        form.website = { value: "" };

        evaluateScript("public/js/subscriber-login.js", mockWindow);
        await mockWindow.dispatchEvent({ type: "DOMContentLoaded" });
      });

      test("warns user if email input is empty", async () => {
        emailInput.value = "   ";
        await form.dispatchEvent({ type: "submit", preventDefault: jest.fn() });

        expect(mockWindow.UXCore.toast.show).toHaveBeenCalledWith(
          "Please enter your email address to continue.",
          "warn",
          expect.any(Object),
        );
        expect(mockWindow.fetch).not.toHaveBeenCalled();
      });

      test("submits login payload including empty honeypot field", async () => {
        emailInput.value = "user@example.com";
        form.website.value = "";
        mockWindow.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: "Magic link dispatched." }),
        });

        await form.dispatchEvent({ type: "submit", preventDefault: jest.fn() });

        expect(mockWindow.fetch).toHaveBeenCalledWith("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "user@example.com", website: "" }),
        });
        expect(statusEl.textContent).toBe("Magic link dispatched.");
        expect(emailInput.value).toBe("");
      });

      test("sends filled honeypot field untouched for server-side bot trapping", async () => {
        emailInput.value = "bot@spammer.com";
        form.website.value = "https://spam-bot.site";

        mockWindow.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: "Magic link dispatched." }),
        });

        await form.dispatchEvent({ type: "submit", preventDefault: jest.fn() });

        expect(mockWindow.fetch).toHaveBeenCalledWith("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "bot@spammer.com",
            website: "https://spam-bot.site",
          }),
        });
      });

      test("handles network errors gracefully", async () => {
        emailInput.value = "user@example.com";
        mockWindow.fetch.mockRejectedValueOnce(new Error("Network failed"));

        await form.dispatchEvent({ type: "submit", preventDefault: jest.fn() });

        expect(statusEl.textContent).toContain("Network error");
        expect(submitBtn.disabled).toBe(false);
      });
    });

    describe("Signup Form (public/js/subscriber-signup.js)", () => {
      let form, emailInput, submitBtn, statusEl;

      beforeEach(async () => {
        form = mockDocument._registerElement("subscriberSignupForm", "FORM");
        emailInput = mockDocument._registerElement("subscriberSignupEmail", "INPUT");
        submitBtn = mockDocument._registerElement("subscriberSignupBtn", "BUTTON");
        statusEl = mockDocument._registerElement("subscriberSignupStatus", "DIV");
        form.website = { value: "" };

        evaluateScript("public/js/subscriber-signup.js", mockWindow);
        await mockWindow.dispatchEvent({ type: "DOMContentLoaded" });
      });

      test("submits email and honeypot to /subscribe and shows CTA toast", async () => {
        emailInput.value = "newsubscriber@example.com";
        mockWindow.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: "Check your inbox to confirm." }),
        });

        await form.dispatchEvent({ type: "submit", preventDefault: jest.fn() });

        expect(mockWindow.fetch).toHaveBeenCalledWith("/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "newsubscriber@example.com", website: "" }),
        });
        expect(statusEl.textContent).toBe("Check your inbox to confirm.");
        expect(mockWindow.UXCore.toast.show).toHaveBeenCalledWith(
          expect.stringContaining("Check your inbox to confirm."),
          "success",
          expect.objectContaining({
            cta: { label: "Try Focus Companion ⚡", href: "/routine" },
          }),
        );
      });

      test("formats array error responses from server", async () => {
        emailInput.value = "invalid-email";
        mockWindow.fetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({ errors: ["Invalid email format", "Domain unresolvable"] }),
        });

        await form.dispatchEvent({ type: "submit", preventDefault: jest.fn() });

        expect(statusEl.textContent).toBe("Invalid email format, Domain unresolvable");
        expect(mockWindow.UXCore.toast.show).toHaveBeenCalledWith(
          "Invalid email format, Domain unresolvable",
          "error",
          expect.any(Object),
        );
        expect(submitBtn.disabled).toBe(false);
      });
    });
  });
});
