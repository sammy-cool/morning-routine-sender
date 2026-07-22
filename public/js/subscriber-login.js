globalThis.addEventListener("DOMContentLoaded", function () {
  (function () {
    const form = document.getElementById("subscriberLoginForm");
    const emailInput = document.getElementById("subscriberLoginEmail");
    const submitBtn = document.getElementById("subscriberLoginBtn");
    const status = document.getElementById("subscriberLoginStatus");

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = emailInput.value.trim();
      if (!email) {
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
        status.textContent =
          data.message ||
          "If that email is subscribed, a login link has been sent.";
        emailInput.value = "";
      } catch (err) {
        console.error(err);
        status.textContent = "Network error. Please try again.";
      } finally {
        submitBtn.disabled = false;
      }
    });
  })();
});
