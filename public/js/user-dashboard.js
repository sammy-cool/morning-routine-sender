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
    const trackGrid = document.getElementById("trackGrid");

    const preferencesForm = document.getElementById("preferencesForm");
    const savePrefsBtn = document.getElementById("savePrefsBtn");
    const saveStatus = document.getElementById("saveStatus");
    const pauseResumeBtn = document.getElementById("pauseResumeBtn");
    const actionStatus = document.getElementById("actionStatus");
    const historyList = document.getElementById("historyList");
    const logoutBtn = document.getElementById("logoutBtn");

    let currentSubscriber = null;

    // Toast helper with full customizable-toast-notification capabilities
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

      if (globalThis.ToastManager && typeof globalThis.ToastManager.show === "function") {
        globalThis.ToastManager.show({ message, type, ...options });
      }
    }

    // Multi-track card selector
    function selectTrack(track) {
      if (!track) return;
      prefTrack.value = track;
      document.querySelectorAll(".track-card").forEach((c) => {
        const isMatch = c.getAttribute("data-track") === track;
        c.classList.toggle("selected", isMatch);
        c.setAttribute("aria-checked", isMatch ? "true" : "false");
      });
    }

    if (trackGrid) {
      trackGrid.addEventListener("click", function (e) {
        const card = e.target.closest(".track-card");
        if (card) {
          const track = card.getAttribute("data-track");
          selectTrack(track);
        }
      });
      trackGrid.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          const card = e.target.closest(".track-card");
          if (card) {
            e.preventDefault();
            const track = card.getAttribute("data-track");
            selectTrack(track);
          }
        }
      });
    }

    // Time select handling
    if (visualTimeSelect) {
      visualTimeSelect.addEventListener("change", function () {
        if (this.value === "custom") {
          prefCron.style.display = "block";
        } else {
          prefCron.style.display = "none";
          prefCron.value = this.value;
        }
      });
    }

    // Auto-detect timezone
    if (autoDetectTzBtn) {
      autoDetectTzBtn.addEventListener("click", function () {
        try {
          const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (userTz) {
            prefTz.value = userTz;
            showToast("Timezone auto-detected: " + userTz, "success");
          }
        } catch (e) {
          console.error("Timezone auto-detect error", e);
        }
      });
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
      // Normalize isActive: true by default unless explicitly false
      const isActive = sub.isActive !== false && sub.isActive !== 0 && sub.isActive !== "false";
      currentSubscriber = { ...sub, isActive };

      subEmail.textContent = sub.email;
      subStatusBadge.textContent = isActive ? "Active" : "Paused";
      subStatusBadge.className = "status-badge " + (isActive ? "active" : "paused");

      // Streak Banner
      const streak = Number(sub.streakCount) || 0;
      if (streakHeroCard) {
        streakHeroCard.style.display = "flex";
        streakCountTitle.textContent = `${streak}-Day Streak Active 🔥`;
        if (streak > 0) {
          streakSubtext.textContent = `You're on day ${streak} of building your daily morning routine. Consistency creates mastery!`;
        } else {
          streakSubtext.textContent = "Start today's ritual to ignite your morning focus streak.";
        }
      }

      // Track Selection
      let activeTrack = sub.routineTrack || sub.templateType || "deep-work";
      if (activeTrack === "basic" || activeTrack === "default") {
        activeTrack = "deep-work";
      }
      selectTrack(activeTrack);

      // Cron & Time Select
      const cron = sub.cronPattern || "0 8 * * *";
      prefCron.value = cron;
      let matchedOption = false;
      if (visualTimeSelect) {
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
      }

      prefTz.value = sub.timezone || "Asia/Kolkata";
      pauseResumeBtn.textContent = isActive ? "Pause my routine" : "Resume my routine";
      pauseResumeBtn.className = "btn " + (isActive ? "btn-warning" : "btn-success");
    }

    function renderHistory(history) {
      if (!history || history.length === 0) {
        historyList.innerHTML = '<p class="meta" style="margin:0">No dispatch history recorded yet.</p>';
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
        const [meResp, historyResp] = await Promise.all([
          fetch("/me", {
            cache: "no-store",
            headers: { "Pragma": "no-cache" },
          }),
          fetch("/me/history?limit=20", {
            cache: "no-store",
            headers: { "Pragma": "no-cache" },
          }).catch(() => ({ ok: false })),
        ]);

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

        if (historyResp && historyResp.ok) {
          const historyData = await historyResp.json().catch(() => ({ history: [] }));
          renderHistory(historyData.history || []);
        } else {
          renderHistory([]);
        }

        loadingCard.style.display = "none";
        subscriptionCard.style.display = "block";
        const streakExportCard = document.getElementById("streakExportCard");
        if (streakExportCard) streakExportCard.style.display = "block";
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
          headers: {
            "Content-Type": "application/json",
            "Pragma": "no-cache"
          },
          body: JSON.stringify(body),
        });
        const data = await resp.json();

        if (!resp.ok) {
          saveStatus.textContent = data.error || (data.errors || []).join(", ") || "Failed to save.";
          return;
        }
        renderSubscription(data);
        saveStatus.textContent = "✅ Preferences saved successfully!";
        showToast("Routine preferences updated!", "success", {
          allowHtml: true,
          cta: {
            label: "⚡ Live Routine View",
            variant: "link",
            href: "/routine",
          },
        });
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

      const nextActiveState = !currentSubscriber.isActive;

      try {
        const resp = await fetch("/me", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Pragma": "no-cache"
          },
          body: JSON.stringify({ isActive: nextActiveState }),
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

    // --- Push Notification Controller ---
    const notificationCard = document.getElementById("notificationCard");
    const notifStatusBadge = document.getElementById("notifStatusBadge");
    const enableNotifBtn = document.getElementById("enableNotifBtn");
    const testNotifBtn = document.getElementById("testNotifBtn");
    const notifNotice = document.getElementById("notifNotice");
    const notifToggleTitle = document.getElementById("notifToggleTitle");

    function syncNotificationState() {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        if (notificationCard) notificationCard.style.display = "block";
        if (notifStatusBadge) {
          notifStatusBadge.textContent = "Unsupported";
          notifStatusBadge.className = "status-badge paused";
        }
        if (enableNotifBtn) enableNotifBtn.disabled = true;
        if (notifNotice) notifNotice.textContent = "Push notifications are not supported in this browser.";
        return;
      }

      if (notificationCard) notificationCard.style.display = "block";

      const permission = Notification.permission;
      if (permission === "granted") {
        if (notifStatusBadge) {
          notifStatusBadge.textContent = "Active 🔔";
          notifStatusBadge.className = "status-badge active";
        }
        if (notifToggleTitle) notifToggleTitle.textContent = "Morning Notifications Active";
        if (enableNotifBtn) {
          enableNotifBtn.innerHTML = '<i class="fas fa-check"></i> Notifications Enabled';
          enableNotifBtn.className = "btn btn-success";
          enableNotifBtn.disabled = true;
        }
        if (testNotifBtn) testNotifBtn.style.display = "inline-flex";
        if (notifNotice) notifNotice.textContent = "✅ You will receive daily morning reminders when your routine goes live.";
      } else if (permission === "denied") {
        if (notifStatusBadge) {
          notifStatusBadge.textContent = "Blocked 🚫";
          notifStatusBadge.className = "status-badge paused";
        }
        if (notifToggleTitle) notifToggleTitle.textContent = "Notifications Blocked";
        if (enableNotifBtn) {
          enableNotifBtn.innerHTML = '<i class="fas fa-ban"></i> Permission Blocked';
          enableNotifBtn.className = "btn btn-warning";
          enableNotifBtn.disabled = true;
        }
        if (testNotifBtn) testNotifBtn.style.display = "none";
        if (notifNotice) notifNotice.innerHTML = "⚠️ Notifications were blocked. To enable, click the lock icon in your browser URL bar and allow notifications.";
      } else {
        if (notifStatusBadge) {
          notifStatusBadge.textContent = "Disabled 🔕";
          notifStatusBadge.className = "status-badge paused";
        }
        if (notifToggleTitle) notifToggleTitle.textContent = "Enable Morning Push Alerts";
        if (enableNotifBtn) {
          enableNotifBtn.innerHTML = '<i class="fas fa-bell"></i> Enable Notifications';
          enableNotifBtn.className = "btn btn-primary";
          enableNotifBtn.disabled = false;
        }
        if (testNotifBtn) testNotifBtn.style.display = "none";
        if (notifNotice) notifNotice.textContent = "Allow notifications to receive wake-up alerts and streak reminders.";
      }
    }

    if (enableNotifBtn) {
      enableNotifBtn.addEventListener("click", async function () {
        try {
          const permission = await Notification.requestPermission();
          syncNotificationState();
          if (permission === "granted") {
            showToast("🎉 Push notifications enabled!", "success");
          } else if (permission === "denied") {
            showToast("Notifications were denied in browser settings.", "warn");
          }
        } catch (err) {
          console.error("Failed to request notification permission", err);
        }
      });
    }

    if (testNotifBtn) {
      testNotifBtn.addEventListener("click", async function () {
        try {
          if (Notification.permission !== "granted") {
            showToast("Please enable notifications first.", "warn");
            return;
          }
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification("🌅 Time for your Morning Routine!", {
            body: "Your daily focus ritual is ready. Click to open your live timer & streak check-in.",
            icon: "/assets/mrn-brand-ico.png",
            badge: "/assets/mrn-brand-ico.png",
            tag: "morning-routine-test",
            renotify: true,
            data: {
              url: "/routine",
            },
            actions: [
              { action: "open_routine", title: "⚡ Start Ritual" },
              { action: "checkin", title: "🔥 1-Click Check-in" },
            ],
          });
          showToast("Test notification sent! Check your notification center.", "info");
        } catch (err) {
          console.error("Test notification failed", err);
          showToast("Could not display notification.", "error");
        }
      });
    }

    loadDashboard();
    syncNotificationState();
  })();
});
