globalThis.addEventListener("DOMContentLoaded", function () {
  (function () {
    const form = document.getElementById("subscriberSignupForm");
    const emailInput = document.getElementById("subscriberSignupEmail");
    const submitBtn = document.getElementById("subscriberSignupBtn");
    const statusEl = document.getElementById("subscriberSignupStatus");

    if (!form) return;

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
          statusEl.textContent =
            (data.errors || []).join(", ") || "Something went wrong.";
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
