// Block admin UI if offline (Priority-1)
if (!navigator.onLine) {
  document.body.innerHTML =
    "<h2>Admin features require an internet connection.</h2>";
  throw new Error("Offline admin access blocked");
}

// OPTIONAL: also handle future offline events
window.addEventListener("offline", () => {
  document.body.innerHTML =
    "<h2>Admin features require an internet connection.</h2>";
});
