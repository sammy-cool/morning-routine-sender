(function () {
  let deferredPrompt = null;
  const DISMISS_KEY = "mrn_pwa_install_dismissed";
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  function isStandalone() {
    return (
      globalThis.matchMedia("(display-mode: standalone)").matches ||
      globalThis.navigator.standalone === true
    );
  }

  function isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !globalThis.MSStream;
  }

  function showToast(message, type = "info", options = {}) {
    const toastLib =
      (typeof window !== "undefined" && window.customizableToast) ||
      (typeof customizableToast !== "undefined" ? customizableToast : null);

    if (toastLib && typeof toastLib.createToast === "function") {
      return toastLib.createToast({
        message,
        type: type === "warn" ? "warning" : type,
        position: "top-center",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        borderRadius: "14px",
        showProgressBar: true,
        progressPosition: "bottom",
        pauseOnHover: true,
        duration: 4500,
        ...options,
      });
    }

    if (globalThis.ToastManager && typeof globalThis.ToastManager.show === "function") {
      globalThis.ToastManager.show({ message, type, ...options });
    }
  }

  globalThis.addEventListener("DOMContentLoaded", function () {
    const installBanner = document.getElementById("pwaInstallBanner");
    const bannerInstallBtn = document.getElementById("pwaBannerInstallBtn");
    const bannerDismissBtn = document.getElementById("pwaBannerDismissBtn");
    const navInstallBtn = document.getElementById("pwaNavInstallBtn");
    const iosInstallModal = document.getElementById("pwaIosModal");
    const iosModalCloseBtn = document.getElementById("pwaIosCloseBtn");

    if (isStandalone()) {
      if (navInstallBtn) navInstallBtn.style.display = "none";
      if (installBanner) installBanner.style.display = "none";
      return;
    }

    const lastDismissed = Number(localStorage.getItem(DISMISS_KEY)) || 0;
    const isDismissCooldown = Date.now() - lastDismissed < SEVEN_DAYS_MS;

    function revealBanner() {
      if (installBanner && !isDismissCooldown && !isStandalone()) {
        installBanner.style.display = "flex";
        setTimeout(() => {
          installBanner.classList.add("visible");
        }, 100);
      }
      if (navInstallBtn && !isStandalone()) {
        navInstallBtn.style.display = "inline-flex";
      }
    }

    // Chrome, Edge, Android PWA event
    globalThis.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      setTimeout(revealBanner, 1200);
    });

    // If on iOS Safari, also reveal button after page load
    if (isIos() && !isStandalone()) {
      setTimeout(revealBanner, 1500);
    }

    async function triggerInstallFlow() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          showToast("Installing Morning Routine App...", "success");
          if (installBanner) installBanner.style.display = "none";
          if (navInstallBtn) navInstallBtn.style.display = "none";
        }
        deferredPrompt = null;
      } else if (isIos()) {
        if (iosInstallModal) {
          iosInstallModal.style.display = "flex";
          setTimeout(() => iosInstallModal.classList.add("visible"), 50);
        } else {
          showToast(
            "To install on iOS: Tap Share (⎋) and select 'Add to Home Screen' (+).",
            "info",
            { duration: 6000 },
          );
        }
      } else {
        showToast("To install, use the browser menu or address bar install icon.", "info");
      }
    }

    if (bannerInstallBtn) {
      bannerInstallBtn.addEventListener("click", triggerInstallFlow);
    }

    if (navInstallBtn) {
      navInstallBtn.addEventListener("click", triggerInstallFlow);
    }

    if (bannerDismissBtn) {
      bannerDismissBtn.addEventListener("click", function () {
        if (installBanner) {
          installBanner.classList.remove("visible");
          setTimeout(() => {
            installBanner.style.display = "none";
          }, 300);
        }
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
      });
    }

    function closeIosModal() {
      if (iosInstallModal) {
        iosInstallModal.classList.remove("visible");
        setTimeout(() => {
          iosInstallModal.style.display = "none";
        }, 300);
      }
    }

    if (iosModalCloseBtn && iosInstallModal) {
      iosModalCloseBtn.addEventListener("click", closeIosModal);
      iosInstallModal.addEventListener("click", function (e) {
        if (e.target === iosInstallModal) {
          closeIosModal();
        }
      });
      globalThis.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && iosInstallModal.classList.contains("visible")) {
          closeIosModal();
        }
      });
    }

    globalThis.addEventListener("appinstalled", () => {
      showToast("🎉 Morning Routine installed successfully!", "success");
      if (installBanner) installBanner.style.display = "none";
      if (navInstallBtn) navInstallBtn.style.display = "none";
      deferredPrompt = null;
    });
  });
})();
