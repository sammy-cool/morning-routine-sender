globalThis.addEventListener("DOMContentLoaded", function () {
  (function () {
    const form = document.getElementById("subscriberSignupForm");
    const emailInput = document.getElementById("subscriberSignupEmail");
    const submitBtn = document.getElementById("subscriberSignupBtn");
    const statusEl = document.getElementById("subscriberSignupStatus");

    if (!form) return;

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
        const data = await resp.json();

        if (!resp.ok) {
          const errMsg = (data.errors || []).join(", ") || data.message || "Something went wrong.";
          statusEl.textContent = errMsg;
          showToast(errMsg, "error");
          return;
        }

        const msg = data.message || "Check your inbox to confirm your subscription.";
        statusEl.textContent = msg;
        showToast(msg, "success", { duration: 6000 });
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
