globalThis.addEventListener("DOMContentLoaded", function () {
  (function () {
    const modalWrap = document.getElementById("keyModal");
    const openBtn = document.getElementById("openModalBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const submitBtn = document.getElementById("submitBtn");
    const adminKeyInput = document.getElementById("adminKey");

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
    submitBtn.addEventListener("click", async function () {
      const key = adminKeyInput.value.trim();
      if (!key) {
        adminKeyInput.focus();
        return;
      }
      submitBtn.disabled = true;
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
      } finally {
        submitBtn.disabled = false;
      }
    });
  })();
});
