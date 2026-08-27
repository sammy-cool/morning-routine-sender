window.addEventListener("DOMContentLoaded", function () {
  const loader = document.getElementById("loader");
  const skeleton = document.getElementById("skeletonContainer");
  const offPageLoader = document.getElementById("offPageLoader");
  const logoBox = document.getElementById("logoBox");
  const loaderRoot = document.getElementById("loaderRoot");

  const mainRoot = document.getElementById("mainRoot");
  const mainRootHeader = document.getElementById("mainRootHeader");
  const mainRootFooter = document.getElementById("mainRootFooter");

  function revealContent() {
    if (loader) loader.remove();
    if (skeleton) skeleton.remove();
    if (offPageLoader) offPageLoader.remove();
    if (loaderRoot) loaderRoot.remove();

    if (mainRoot) mainRoot.style.display = "block";
    if (mainRootHeader) mainRootHeader.style.display = "block";
    if (mainRootFooter) mainRootFooter.style.display = "block";
  }

  // Safe particle burst animation if logoBox exists
  if (logoBox) {
    try {
      for (let i = 0; i < 20; i++) {
        const p = document.createElement("span");
        p.classList.add("particle");
        const tx = (Math.random() - 0.5) * 280 + "px";
        const ty = (Math.random() - 0.5) * 280 + "px";
        p.style.setProperty("--tx", tx);
        p.style.setProperty("--ty", ty);
        logoBox.appendChild(p);
        setTimeout(() => p.remove(), 1200);
      }
    } catch (e) {
      console.warn("Particle animation skipped:", e);
    }
  }

  if (loader) loader.classList.add("fade-out");
  if (skeleton) skeleton.classList.add("fade-out");
  if (loaderRoot) loaderRoot.classList.add("fade-out");

  setTimeout(revealContent, 300);
});
