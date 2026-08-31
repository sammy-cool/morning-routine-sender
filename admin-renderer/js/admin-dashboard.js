// Block admin UI if offline safely (Priority-1)
function checkAdminOnlineStatus() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (document.body) {
      const banner = document.createElement("div");
      banner.id = "adminOfflineBanner";
      banner.style.cssText =
        "position:fixed;top:0;left:0;width:100%;background:#ef4444;color:#fff;text-align:center;padding:12px;font-weight:700;z-index:99999;font-family:sans-serif;";
      banner.textContent = "⚠️ Admin operations require an active internet connection.";
      document.body.prepend(banner);
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkAdminOnlineStatus);
} else {
  checkAdminOnlineStatus();
}

window.addEventListener("offline", () => {
  checkAdminOnlineStatus();
});
window.addEventListener("online", () => {
  const banner = document.getElementById("adminOfflineBanner");
  if (banner) banner.remove();
});
