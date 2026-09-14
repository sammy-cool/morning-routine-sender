(function () {
  let dismissed = false;

  function dismissLoader() {
    if (dismissed) return;
    dismissed = true;

    const loader = document.getElementById("loader");
    const skeleton = document.getElementById("skeletonContainer");
    const offPageLoader = document.getElementById("offPageLoader");
    const logoBox = document.getElementById("logoBox");
    const loaderRoot = document.getElementById("loaderRoot");

    const mainRoot = document.getElementById("mainRoot");
    const mainRootHeader = document.getElementById("mainRootHeader");
    const mainRootFooter = document.getElementById("mainRootFooter");

    function revealContent() {
      if (loader && typeof loader.remove === "function") loader.remove();
      if (skeleton && typeof skeleton.remove === "function") skeleton.remove();
      if (offPageLoader && typeof offPageLoader.remove === "function") offPageLoader.remove();
      if (loaderRoot && typeof loaderRoot.remove === "function") loaderRoot.remove();

      if (mainRoot) mainRoot.style.display = "block";
      if (mainRootHeader) mainRootHeader.style.display = "block";
      if (mainRootFooter) mainRootFooter.style.display = "block";
    }

    // Safe particle burst animation if logoBox exists
    if (logoBox && typeof logoBox.appendChild === "function") {
      try {
        for (let i = 0; i < 20; i++) {
          const p = document.createElement("span");
          if (p.classList && typeof p.classList.add === "function") {
            p.classList.add("particle");
          }
          if (p.style && typeof p.style.setProperty === "function") {
            const tx = (Math.random() - 0.5) * 280 + "px";
            const ty = (Math.random() - 0.5) * 280 + "px";
            p.style.setProperty("--tx", tx);
            p.style.setProperty("--ty", ty);
          }
          logoBox.appendChild(p);
          setTimeout(() => {
            if (p && typeof p.remove === "function") p.remove();
          }, 1200);
        }
      } catch (_e) {
        // ignore non-critical particle creation errors
      }
    }

    if (loader && loader.classList && typeof loader.classList.add === "function") {
      loader.classList.add("fade-out");
    }
    if (skeleton && skeleton.classList && typeof skeleton.classList.add === "function") {
      skeleton.classList.add("fade-out");
    }
    if (loaderRoot && loaderRoot.classList && typeof loaderRoot.classList.add === "function") {
      loaderRoot.classList.add("fade-out");
    }

    setTimeout(revealContent, 300);
  }

  // Fail-safe fallback timer (3500ms <= 3.5s)
  const fallbackTimer = setTimeout(dismissLoader, 3500);

  if (document.readyState === "complete" || document.readyState === "interactive") {
    clearTimeout(fallbackTimer);
    dismissLoader();
  } else {
    if (typeof window.addEventListener === "function") {
      window.addEventListener("DOMContentLoaded", function () {
        clearTimeout(fallbackTimer);
        dismissLoader();
      });
      window.addEventListener("load", function () {
        clearTimeout(fallbackTimer);
        dismissLoader();
      });
    }
  }
})();
