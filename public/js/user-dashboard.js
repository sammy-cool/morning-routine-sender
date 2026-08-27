globalThis.addEventListener("DOMContentLoaded", function () {
  (function () {
    const loadingCard = document.getElementById("loadingCard");
    const streakHeroCard = document.getElementById("streakHeroCard");
    const streakCountTitle = document.getElementById("streakCountTitle");
    const streakSubtext = document.getElementById("streakSubtext");
    const subscriptionCard = document.getElementById("subscriptionCard");
    const historyCard = document.getElementById("historyCard");
    const errorCard = document.getElementById("errorCard");
    const errorMessage = document.getElementById("errorMessage");

    const subEmail = document.getElementById("subEmail");
    const subStatusBadge = document.getElementById("subStatusBadge");
    const visualTimeSelect = document.getElementById("visualTimeSelect");
    const prefCron = document.getElementById("prefCron");
    const prefTz = document.getElementById("prefTz");
    const autoDetectTzBtn = document.getElementById("autoDetectTzBtn");
    const prefTrack = document.getElementById("prefTrack");
    const trackCards = document.querySelectorAll(".track-card");

    const preferencesForm = document.getElementById("preferencesForm");
    const savePrefsBtn = document.getElementById("savePrefsBtn");
    const saveStatus = document.getElementById("saveStatus");
    const pauseResumeBtn = document.getElementById("pauseResumeBtn");
    const actionStatus = document.getElementById("actionStatus");
    const historyList = document.getElementById("historyList");
    const logoutBtn = document.getElementById("logoutBtn");

    let currentSubscriber = null;

    // Multi-track card selector
    trackCards.forEach((card) => {
      card.addEventListener("click", function () {
        trackCards.forEach((c) => c.classList.remove("selected"));
        this.classList.add("selected");
        prefTrack.value = this.getAttribute("data-track");
      });
    });

    // Time select handling
    visualTimeSelect.addEventListener("change", function () {
      if (this.value === "custom") {
        prefCron.style.display = "block";
      } else {
        prefCron.style.display = "none";
        prefCron.value = this.value;
      }
    });

    // Auto-detect timezone
    if (autoDetectTzBtn) {
      autoDetectTzBtn.addEventListener("click", function () {
        try {
          const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (userTz) {
            prefTz.value = userTz;
            showToast("Timezone detected: " + userTz, "success");
          }
        } catch (e) {
          console.error("Timezone auto-detect error", e);
        }
      });
    }

    function showToast(message, type = "info") {
      if (globalThis.ToastManager && typeof globalThis.ToastManager.show === "function") {
        globalThis.ToastManager.show(message, type);
      } else if (globalThis.CustomizableToast && typeof globalThis.CustomizableToast.show === "function") {
        globalThis.CustomizableToast.show({ message, type });
      }
    }

    function showError(message) {
      loadingCard.style.display = "none";
      if (streakHeroCard) streakHeroCard.style.display = "none";
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

      // Streak Banner
      const streak = Number(sub.streakCount) || 0;
      if (streakHeroCard) {
        streakHeroCard.style.display = "flex";
        streakCountTitle.textContent = `${streak}-Day Streak Active 🔥`;
        if (streak > 0) {
          streakSubtext.textContent = `You're on day ${streak} of building your morning routine habit. Awesome consistency!`;
        } else {
          streakSubtext.textContent = "Complete your first morning routine today to ignite your streak counter.";
        }
      }

      // Track Selection
      const activeTrack = sub.routineTrack || sub.templateType || "deep-work";
      prefTrack.value = activeTrack;
      trackCards.forEach((c) => {
        if (c.getAttribute("data-track") === activeTrack) {
          c.classList.add("selected");
        } else {
          c.classList.remove("selected");
        }
      });

      // Cron & Time Select
      const cron = sub.cronPattern || "0 8 * * *";
      prefCron.value = cron;
      let matchedOption = false;
      for (let opt of visualTimeSelect.options) {
        if (opt.value === cron) {
          visualTimeSelect.value = cron;
          matchedOption = true;
          prefCron.style.display = "none";
          break;
        }
      }
      if (!matchedOption) {
        visualTimeSelect.value = "custom";
        prefCron.style.display = "block";
      }

      prefTz.value = sub.timezone || "";
      pauseResumeBtn.textContent = sub.isActive ? "Pause my routine" : "Resume my routine";
      pauseResumeBtn.className = "btn " + (sub.isActive ? "btn-warning" : "btn-success");
    }

    function renderHistory(history) {
      if (history.length === 0) {
        historyList.innerHTML = '<p class="meta" style="margin:0">No sends recorded yet.</p>';
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
      saveStatus.textContent = "Saving preferences...";

      try {
        const cronValue =
          visualTimeSelect.value === "custom" ? prefCron.value.trim() : visualTimeSelect.value;

        const body = {
          cronPattern: cronValue || "0 8 * * *",
          timezone: prefTz.value.trim() || "Asia/Kolkata",
          routineTrack: prefTrack.value || "deep-work",
          templateType: prefTrack.value || "deep-work",
        };

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
        saveStatus.textContent = "✅ Preferences saved successfully!";
        showToast("Routine preferences updated!", "success");
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
      actionStatus.textContent = "Updating status...";

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
          ? "▶️ Your daily routine is active."
          : "⏸️ Your routine is paused.";
        showToast(data.isActive ? "Routine resumed!" : "Routine paused.", "info");
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
