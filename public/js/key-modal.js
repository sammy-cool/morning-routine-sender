window.addEventListener("DOMContentLoaded", () => {
  setTimeout(showKeyPrompt, 800); // give skeleton time to load
});

function showKeyPrompt() {
  const key = prompt("Enter your access key:");
  if (!key) {
    alert("Access key is required!");
    return (window.location.href = "/user-dashboard");
  }

  // Show loader for UX
  document.body.innerHTML =
    '<div class="loader" style="width:70px;height:70px;border:6px solid #ccc;border-top:6px solid #007bff;border-radius:50%;animation:spin 1s linear infinite;"></div>';

  fetch("/generate-admin-key?adminSecret=" + key)
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        try {
          const { key } = data;
          const resp = await fetch("/verify-admin-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
          });
          const j = await resp.json();
          if (resp.ok && j.role === "admin") {
            // Admin -> redirect to existing admin dashboard
            localStorage.setItem("userRole", "admin");
            return (window.location.href = "/admin-dashboard");
            // globalThis.location.href = "/admin-dashboard";
          }
        } catch (err) {
          console.error("Error verifying key:", err);
          localStorage.setItem("userRole", "user");
          window.location.href = "/user-dashboard";
        }
      } else {
        localStorage.setItem("userRole", "user");
        return (window.location.href = "/user-dashboard");
      }
    })
    .catch((err) => {
      console.error("Error verifying key:", err);
      localStorage.setItem("userRole", "user");
      window.location.href = "/user-dashboard";
    });
}
