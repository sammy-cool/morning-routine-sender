globalThis.addEventListener("DOMContentLoaded", function () {
  (function () {
    const form = document.getElementById("subscriberSignupForm");
    const emailInput = document.getElementById("subscriberSignupEmail");
    const submitBtn = document.getElementById("subscriberSignupBtn");
    const statusEl = document.getElementById("subscriberSignupStatus");

    if (!form) return; // page doesn't have this section, nothing to wire up

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
          body: JSON.stringify({ email }),
        });
        const data = await resp.json();

        if (!resp.ok) {
          // Only format-level errors (e.g. invalid email) land here --
          // /subscribe deliberately still returns a normal 200 with a
          // generic message when the email is already subscribed, same
          // enumeration-safety reasoning as the login form.
          statusEl.textContent = (data.errors || []).join(", ") || "Something went wrong.";
          return;
        }

        statusEl.textContent =
          data.message || "Check your inbox to confirm your subscription.";
        emailInput.value = "";
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Network error. Please try again.";
      } finally {
        submitBtn.disabled = false;
      }
    });
  })();
});
