globalThis.addEventListener("DOMContentLoaded", function () {
  (function () {
    const form = document.getElementById("subscriberLoginForm");
    const emailInput = document.getElementById("subscriberLoginEmail");
    const submitBtn = document.getElementById("subscriberLoginBtn");
    const status = document.getElementById("subscriberLoginStatus");

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

    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = emailInput.value.trim();
      if (!email) {
        showToast("Please enter your email address to continue.", "warn");
        emailInput.focus();
        return;
      }

      submitBtn.disabled = true;
      status.textContent = "Sending...";

      try {
        const resp = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            website: form.website ? form.website.value : "",
          }),
        });
        const data = await resp.json();
        if (resp.ok) {
          const successMsg =
            data.message || "If that email is subscribed, a magic login link has been sent.";
          if (status) status.textContent = successMsg;
          showToast(successMsg, "success", { duration: 6000 });
          emailInput.value = "";
        } else {
          const errorMsg = data.message || "Unable to send login link. Please try again.";
          if (status) status.textContent = errorMsg;
          showToast(errorMsg, "error");
        }
      } catch (err) {
        console.error(err);
        const netErrMsg = "Network error. Please try again.";
        if (status) status.textContent = netErrMsg;
        showToast(netErrMsg, "error");
      } finally {
        submitBtn.disabled = false;
      }
    });
  })();
});
