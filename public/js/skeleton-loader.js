window.addEventListener("load", function () {
  // start dissolve animation
  const loader = document.getElementById("loader");
  const skeleton = document.getElementById("skeletonContainer");
  const offPageLoader = document.getElementById("offPageLoader");
  const logoBox = document.getElementById("logoBox");

  setTimeout(() => {
    // create brand-colored particle bursts
    for (let i = 0; i < 22; i++) {
      const p = document.createElement("span");
      p.classList.add("particle");
      const tx = (Math.random() - 0.5) * 280 + "px";
      const ty = (Math.random() - 0.5) * 280 + "px";
      p.style.setProperty("--tx", tx);
      p.style.setProperty("--ty", ty);
      logoBox.appendChild(p);
      setTimeout(() => p.remove(), 1800);
    }

    // setTimeout(() => {
    loader.classList.add("fade-out");
    skeleton.classList.add("fade-out");
    // skeleton.style.transition = "opacity 1s ease";
    // skeleton.style.opacity = "0";

    // loader.remove();
    // skeleton.remove();

    // === SWITCH TO NEXT PAGE (fully loaded) ===
    // globalThis.location.replace("./old-index.html");
    // location.replace ensures no history entry
    // offPageLoader.remove();
    // }, 1900);

    const mainRoot = document.getElementById("mainRoot");
    const mainRootHeader = document.getElementById("mainRootHeader");
    const mainRootFooter = document.getElementById("mainRootFooter");
    const modalWrapId = document.getElementById("keyModal");

    setTimeout(function () {
      loader.remove();
      skeleton.style.transition = "opacity 1s ease";
      skeleton.style.opacity = "0";
      skeleton.remove();
      offPageLoader.remove();

      mainRoot.style.display = "block";
      mainRootHeader.style.display = "block";
      mainRootFooter.style.display = "block";
      modalWrapId.style.display = "flex";

      // show modal after skeleton is visible (optional)
      // uncomment to auto-open:
      // openModal();
    }, 550);
  }, 900);
});
