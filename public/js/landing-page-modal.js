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

    function openModal() {
      modalWrap.classList.add("open");
      modalWrap.setAttribute("aria-hidden", "false");
      adminKeyInput.focus();
    }
    function closeModal() {
      modalWrap.classList.remove("open");
      modalWrap.setAttribute("aria-hidden", "true");
      adminKeyInput.value = "";
    }

    openBtn.addEventListener("click", function (e) {
      e.preventDefault();
      openModal();
    });
    cancelBtn.addEventListener("click", function () {
      closeModal();
    });

    // Submit -> POST /verify-admin-key
    // (Extracted into a function so the new "generate & continue" flow
    // below can reuse the exact same verify step instead of duplicating it.)
    async function verifyKey(key) {
      try {
        const resp = await fetch("/verify-admin-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
        const j = await resp.json();
        if (resp.ok && j.role === "admin") {
          // Admin -> redirect to existing admin dashboard
          globalThis.location.href = "/admin-dashboard";
        } else {
          // Not admin -> show user interface (already on page); optionally show message
          alert("Key not recognized — showing user view.");
          closeModal();
        }
      } catch (err) {
        console.error(err);
        alert("Network error. Try again.");
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
