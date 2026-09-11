globalThis.addEventListener("DOMContentLoaded", function () {
  (function () {
    const form = document.getElementById("subscriberSignupForm");
    const emailInput = document.getElementById("subscriberSignupEmail");
    const submitBtn = document.getElementById("subscriberSignupBtn");
    const statusEl = document.getElementById("subscriberSignupStatus");

    if (!form) return;

    function showToast(message, type = "info", options = {}) {
      if (globalThis.UXCore?.toast?.show) {
        return globalThis.UXCore.toast.show(message, type, options);
      }

      const toastLib =
        (typeof window !== "undefined" && window.customizableToast) ||
        (typeof customizableToast !== "undefined" ? customizableToast : null);

      if (toastLib && typeof toastLib.createToast === "function") {
        const defaultProgress =
          type === "success"
            ? "#10b981"
            : type === "error"
              ? "#f43f5e"
              : type === "warn" || type === "warning"
                ? "#f59e0b"
                : "#7c3aed";
        return toastLib.createToast({
          message,
          type: type === "warn" ? "warning" : type,
          position: "top-center",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          borderRadius: "16px",
          backgroundColor: "rgba(12, 17, 29, 0.96)",
          textColor: "#f8fafc",
          showProgressBar: true,
          progressPosition: "bottom",
          progressColor: options.progressColor || defaultProgress,
          pauseOnHover: true,
          duration: 4500,
          allowHtml: true,
          ...options,
        });
      }
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const email = emailInput.value.trim();
      if (!email) {
        emailInput.focus();
        return;
      }

      submitBtn.disabled = true;
      statusEl.textContent = "Sending…";

      try {
        const resp = await fetch("/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            website: form.website ? form.website.value : "",
          }),
        });
        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          const errMsg = (data.errors || []).join(", ") || data.message || "Something went wrong.";
          statusEl.textContent = errMsg;
          showToast(errMsg, "error");
          return;
        }

        const msg = data.message || "Check your inbox to confirm your subscription.";
        statusEl.textContent = msg;
        showToast(`🎉 ${msg}`, "success", {
          duration: 7000,
          cta: {
            label: "Try Focus Companion ⚡",
            href: "/routine",
          },
        });
        emailInput.value = "";
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Network error. Please try again.";
        showToast("Network error. Please try again.", "error");
      } finally {
        submitBtn.disabled = false;
      }
    });
  })();
});
