globalThis.addEventListener("DOMContentLoaded", function () {
  (function () {
    const modalWrap = document.getElementById("keyModal");
    const openBtn = document.getElementById("openModalBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const submitBtn = document.getElementById("submitBtn");
    const adminKeyInput = document.getElementById("adminKey");
    const toggleGenerate = document.getElementById("toggleGenerate");
    const generateSection = document.getElementById("generateSection");
    const adminSecretInput = document.getElementById("adminSecret");
    const generateBtn = document.getElementById("generateBtn");
    const generateStatus = document.getElementById("generateStatus");

    if (!modalWrap) return;

    function openModal() {
      modalWrap.style.display = "flex";
      modalWrap.classList.add("open");
      modalWrap.setAttribute("aria-hidden", "false");
      if (openBtn) openBtn.setAttribute("aria-expanded", "true");
      if (adminKeyInput) adminKeyInput.focus();
    }
    function closeModal() {
      modalWrap.classList.remove("open");
      modalWrap.setAttribute("aria-hidden", "true");
      modalWrap.style.display = "none";
      if (openBtn) openBtn.setAttribute("aria-expanded", "false");
      if (adminKeyInput) adminKeyInput.value = "";
    }

    if (openBtn) {
      openBtn.addEventListener("click", function (e) {
        e.preventDefault();
        openModal();
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        closeModal();
      });
    }

    function showToast(message, type = "info", options = {}) {
      if (globalThis.UXCore?.toast?.show) {
        return globalThis.UXCore.toast.show(message, type, options);
      }

      const toastLib =
        (typeof window !== "undefined" && window.customizableToast) ||
        (typeof customizableToast !== "undefined" ? customizableToast : null);

      if (toastLib && typeof toastLib.createToast === "function") {
        return toastLib.createToast({
          message,
          type: type === "warn" ? "warning" : type,
          position: "top-center",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          borderRadius: "16px",
          showProgressBar: true,
          progressPosition: "bottom",
          progressColor: "#7c3aed",
          pauseOnHover: true,
          duration: 4500,
          ...options,
        });
      }
    }

    modalWrap.addEventListener("click", function (e) {
      if (e.target === modalWrap) {
        closeModal();
      }
    });

    globalThis.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modalWrap.classList.contains("open")) {
        closeModal();
      }
    });

    // Submit -> POST /verify-admin-key
    async function verifyKey(key) {
      try {
        const resp = await fetch("/verify-admin-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
        const j = await resp.json();
        if (resp.ok && j.role === "admin") {
          globalThis.location.href = "/admin-dashboard";
        } else {
          showToast("Key not recognized — showing standard user view.", "warning");
          closeModal();
        }
      } catch (err) {
        console.error(err);
        showToast("Network error. Please try again.", "error");
      }
    }

    submitBtn.addEventListener("click", async function () {
      const key = adminKeyInput.value.trim();
      if (!key) {
        adminKeyInput.focus();
        return;
      }
      submitBtn.disabled = true;
      await verifyKey(key);
      submitBtn.disabled = false;
    });

    // Toggle the "generate a key" section open/closed
    toggleGenerate.addEventListener("click", function (e) {
      e.preventDefault();
      const isOpen = generateSection.style.display !== "none";
      generateSection.style.display = isOpen ? "none" : "block";
      generateStatus.textContent = "";
      if (!isOpen) adminSecretInput.focus();
    });

    // Generate -> GET /generate-admin-key, then reuse verifyKey() with the
    // result instead of making the person copy/paste it themselves.
    generateBtn.addEventListener("click", async function () {
      const secret = adminSecretInput.value.trim();
      if (!secret) {
        adminSecretInput.focus();
        return;
      }
      generateBtn.disabled = true;
      generateStatus.textContent = "Generating key…";
      try {
        const resp = await fetch("/generate-admin-key", {
          headers: { "x-admin-secret": secret },
        });
        const data = await resp.json();
        if (!resp.ok) {
          generateStatus.textContent = data.message || "Invalid admin secret.";
          return;
        }
        generateStatus.textContent = "Key generated — logging in…";
        adminKeyInput.value = data.key;
        await verifyKey(data.key);
      } catch (err) {
        console.error(err);
        generateStatus.textContent = "Network error. Try again.";
      } finally {
        generateBtn.disabled = false;
      }
    });
  })();
});
