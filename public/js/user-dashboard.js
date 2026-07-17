globalThis.addEventListener("DOMContentLoaded", function () {
  (function () {
    const loadingCard = document.getElementById("loadingCard");
    const subscriptionCard = document.getElementById("subscriptionCard");
    const historyCard = document.getElementById("historyCard");
    const errorCard = document.getElementById("errorCard");
    const errorMessage = document.getElementById("errorMessage");

    const subEmail = document.getElementById("subEmail");
    const subStatusBadge = document.getElementById("subStatusBadge");
    const prefCron = document.getElementById("prefCron");
    const prefTz = document.getElementById("prefTz");
    const preferencesForm = document.getElementById("preferencesForm");
    const savePrefsBtn = document.getElementById("savePrefsBtn");
    const saveStatus = document.getElementById("saveStatus");
    const pauseResumeBtn = document.getElementById("pauseResumeBtn");
    const actionStatus = document.getElementById("actionStatus");
    const historyList = document.getElementById("historyList");
    const logoutBtn = document.getElementById("logoutBtn");

    let currentSubscriber = null;

    function showError(message) {
      loadingCard.style.display = "none";
      subscriptionCard.style.display = "none";
      historyCard.style.display = "none";
      errorCard.style.display = "block";
      errorMessage.textContent = message;
    }

    function renderSubscription(sub) {
      currentSubscriber = sub;
      subEmail.textContent = sub.email;
      subStatusBadge.textContent = sub.isActive ? "Active" : "Paused";
      subStatusBadge.className = "status-badge " + (sub.isActive ? "active" : "paused");
      prefCron.value = sub.cronPattern || "";
      prefTz.value = sub.timezone || "";
      pauseResumeBtn.textContent = sub.isActive ? "Pause my routine" : "Resume my routine";
      pauseResumeBtn.className = "btn " + (sub.isActive ? "btn-warning" : "btn-success");
    }

    function renderHistory(history) {
      if (history.length === 0) {
        historyList.innerHTML = '<p class="meta" style="margin:0">No sends yet.</p>';
        return;
      }
      historyList.innerHTML = history
        .map((h) => {
          const date = h.sent_at ? new Date(h.sent_at).toLocaleString() : "n/a";
          const status = h.status || "unknown";
          return `
            <div class="history-row">
              <span>${date}</span>
              <span class="history-status ${status}">${status}</span>
            </div>
          `;
        })
        .join("");
    }

    async function loadDashboard() {
      try {
        const meResp = await fetch("/me");
        if (meResp.status === 401) {
          globalThis.location.href = "/";
          return;
        }
        if (!meResp.ok) {
          const err = await meResp.json().catch(() => ({}));
          showError(err.error || "Failed to load your subscription.");
          return;
        }
        const sub = await meResp.json();
        renderSubscription(sub);

        const historyResp = await fetch("/me/history?limit=20");
        const historyData = await historyResp.json().catch(() => ({ history: [] }));
        renderHistory(historyData.history || []);

        loadingCard.style.display = "none";
        subscriptionCard.style.display = "block";
        historyCard.style.display = "block";
      } catch (err) {
        console.error(err);
        showError("Network error while loading your dashboard.");
      }
    }

    preferencesForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      savePrefsBtn.disabled = true;
      saveStatus.textContent = "Saving...";

      try {
        const body = {};
        if (prefCron.value.trim()) body.cronPattern = prefCron.value.trim();
        if (prefTz.value.trim()) body.timezone = prefTz.value.trim();

        const resp = await fetch("/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await resp.json();

        if (!resp.ok) {
          saveStatus.textContent = data.error || (data.errors || []).join(", ") || "Failed to save.";
          return;
        }
        renderSubscription(data);
        saveStatus.textContent = "✅ Saved.";
      } catch (err) {
        console.error(err);
        saveStatus.textContent = "Network error. Please try again.";
      } finally {
        savePrefsBtn.disabled = false;
      }
    });

    pauseResumeBtn.addEventListener("click", async function () {
      if (!currentSubscriber) return;
      pauseResumeBtn.disabled = true;
      actionStatus.textContent = "Updating...";

      try {
        const resp = await fetch("/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !currentSubscriber.isActive }),
        });
        const data = await resp.json();

        if (!resp.ok) {
          actionStatus.textContent = data.error || "Failed to update.";
          return;
        }
        renderSubscription(data);
        actionStatus.textContent = data.isActive
          ? "▶️ Your routine is active again."
          : "⏸️ Your routine is paused.";
      } catch (err) {
        console.error(err);
        actionStatus.textContent = "Network error. Please try again.";
      } finally {
        pauseResumeBtn.disabled = false;
      }
    });

    logoutBtn.addEventListener("click", async function () {
      try {
        await fetch("/logout", { method: "POST" });
      } catch (err) {
        console.error(err);
      }
      globalThis.location.href = "/";
    });

    loadDashboard();
  })();
});
