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

    const prefFocusDuration = document.getElementById("prefFocusDuration");
    const durationSelectBtns = document.querySelectorAll(".duration-select-btn");
    const customHabitsContainer = document.getElementById("customHabitsContainer");
    const newHabitInput = document.getElementById("newHabitInput");
    const addHabitBtn = document.getElementById("addHabitBtn");
    const resetHabitsBtn = document.getElementById("resetHabitsBtn");
    let currentCustomHabits = [];

    const prefCustomQuote = document.getElementById("prefCustomQuote");
    const prefCustomRitual = document.getElementById("prefCustomRitual");
    const prefNewsCategory = document.getElementById("prefNewsCategory");
    const prefWeeklyDigestEnabled = document.getElementById("prefWeeklyDigestEnabled");
    const prefWeeklyDigestDay = document.getElementById("prefWeeklyDigestDay");
    const ambientFreqSelect = document.getElementById("ambientFreqSelect");

    let currentSubscriber = null;

    // Toast helper with full customizable-toast-notification capabilities
    function showToast(message, type = "info", options = {}) {
      if (globalThis.UXCore?.toast?.show) {
        return globalThis.UXCore.toast.show(message, type, options);
      }

      const toastLib =
        (typeof window !== "undefined" && window.customizableToast) ||
        (typeof customizableToast !== "undefined" ? customizableToast : null);

      if (toastLib && typeof toastLib.createToast === "function") {
        const defaultProgress =
          type === "success"
            ? "#10b981"
            : type === "error"
              ? "#f43f5e"
              : type === "warn" || type === "warning"
                ? "#f59e0b"
                : "#7c3aed";
        return toastLib.createToast({
          message,
          type: type === "warn" ? "warning" : type,
          position: "top-center",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          borderRadius: "16px",
          backgroundColor: "rgba(12, 17, 29, 0.96)",
          textColor: "#f8fafc",
          showProgressBar: true,
          progressPosition: "bottom",
          progressColor: options.progressColor || defaultProgress,
          pauseOnHover: true,
          duration: 4500,
          allowHtml: true,
          ...options,
        });
      }

      if (globalThis.ToastManager && typeof globalThis.ToastManager.show === "function") {
        globalThis.ToastManager.show({ message, type, ...options });
      }
    }

    const TRACK_DISPLAY_NAMES = {
      "deep-work": "Deep Work & Flow",
      mindfulness: "Mindfulness & Grounding",
      career: "Career & Ambition",
      learning: "Continuous Learning",
      reflection: "Gratitude & Evening Reflection",
    };

    // Multi-track card selector
    function selectTrack(track, silent = false) {
      if (!track) return;
      prefTrack.value = track;
      document.querySelectorAll(".track-card").forEach((c) => {
        const isMatch = c.getAttribute("data-track") === track;
        c.classList.toggle("selected", isMatch);
        c.setAttribute("aria-checked", isMatch ? "true" : "false");
      });
      if (!silent) {
        showToast(
          `🎯 Focus Track: <b>${TRACK_DISPLAY_NAMES[track] || track}</b> selected`,
          "info",
          {
            duration: 3000,
            progressColor: "#7c3aed",
          },
        );
      }
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

      // Streak Banner & Native App Badge Sync
      const streak = Number(sub.streakCount) || 0;
      if (globalThis.AppBadging) {
        globalThis.AppBadging.updateStreakBadge(streak);
      }
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
      selectTrack(activeTrack, true);

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

      // Sprint Duration
      const duration = Number(sub.focusDurationMinutes) || 25;
      setFocusDurationUI(duration);

      // Custom Habits
      currentCustomHabits = Array.isArray(sub.customHabits) ? [...sub.customHabits] : [];
      renderCustomHabitsList();

      // Dynamic Daily Quote & Focus Ritual
      if (prefCustomQuote) prefCustomQuote.value = sub.customQuote || "";
      if (prefCustomRitual) prefCustomRitual.value = sub.customRitual || "";

      // Dynamic Morning News Category
      if (prefNewsCategory) prefNewsCategory.value = sub.newsCategory || "all";

      // Dynamic Weekly Consistency Digest
      if (prefWeeklyDigestEnabled) {
        prefWeeklyDigestEnabled.checked = sub.weeklyDigestEnabled !== false;
      }
      if (prefWeeklyDigestDay) {
        prefWeeklyDigestDay.value = sub.weeklyDigestDay || "sunday";
      }

      // Dynamic System Broadcast Announcement
      const announcementEl = document.getElementById("systemAnnouncementBanner");
      if (announcementEl) {
        if (sub.systemAnnouncement) {
          announcementEl.innerHTML = `<div style="display: flex; align-items: center; gap: 10px"><span aria-hidden="true">📢</span><span><strong>Announcement:</strong> ${escapeHtml(sub.systemAnnouncement)}</span></div><button type="button" onclick="this.parentElement.style.display='none'" style="background: none; border: none; color: #cbd5e1; cursor: pointer; font-size: 18px; padding: 0 4px; line-height: 1" aria-label="Dismiss announcement">&times;</button>`;
          announcementEl.style.display = "flex";
        } else {
          announcementEl.style.display = "none";
        }
      }
    }

    function setFocusDurationUI(mins) {
      const val = Math.max(5, Math.min(Number(mins) || 25, 180));
      if (prefFocusDuration) prefFocusDuration.value = val;
      if (durationSelectBtns) {
        durationSelectBtns.forEach((btn) => {
          const btnMins = Number(btn.getAttribute("data-mins"));
          if (btnMins === val) {
            btn.classList.remove("btn-secondary");
            btn.classList.add("btn-primary");
          } else {
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-secondary");
          }
        });
      }
    }

    function renderCustomHabitsList() {
      if (!customHabitsContainer) return;
      if (!currentCustomHabits.length) {
        customHabitsContainer.innerHTML =
          '<div class="small" style="color: var(--text-muted); font-style: italic; padding: 6px 0;">Currently using track default habits. Add custom habits below to personalize your routine.</div>';
        return;
      }
      customHabitsContainer.innerHTML = currentCustomHabits
        .map(
          (habit, idx) => `
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.04); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 8px 12px; gap: 8px;">
          <span style="font-size: 13.5px; color: var(--text-main); word-break: break-word;">${escapeHtml(habit)}</span>
          <button type="button" class="remove-habit-btn" data-index="${idx}" style="background: none; border: none; color: #f87171; font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 4px;" title="Remove habit" aria-label="Remove habit">
            &times;
          </button>
        </div>
      `,
        )
        .join("");
    }

    function renderHistory(history) {
      if (!history || history.length === 0) {
        historyList.innerHTML =
          '<p class="meta" style="margin:0">No dispatch history recorded yet.</p>';
        return;
      }
      historyList.innerHTML = history
        .map((h) => {
          const date = h.sent_at ? new Date(h.sent_at).toLocaleString() : "n/a";
          const status = h.status || "unknown";
          return `
            <div class="history-item">
              <span>${date}</span>
              <span class="history-status ${status}">${status}</span>
            </div>
          `;
        })
        .join("");
    }

    async function loadDashboard() {
      // 1. Stale-While-Revalidate (SWR): Instant Cache Hit (<10ms)
      if (globalThis.UXCore?.cache) {
        const cachedProfile = globalThis.UXCore.cache.get("subscriber_profile", 45000);
        if (cachedProfile?.data) {
          renderSubscription(cachedProfile.data);
          loadingCard.style.display = "none";
          subscriptionCard.style.display = "block";
          const streakExportCard = document.getElementById("streakExportCard");
          if (streakExportCard) streakExportCard.style.display = "block";
          const dashboardJournalCard = document.getElementById("dashboardJournalCard");
          if (dashboardJournalCard) dashboardJournalCard.style.display = "block";
          renderChannels(cachedProfile.data);
          renderCoachPersona(cachedProfile.data);
          renderOutboundWebhook(cachedProfile.data);
          historyCard.style.display = "block";
        }
      }

      try {
        const [meResp, historyResp] = await Promise.all([
          fetch("/me", {
            cache: "no-store",
            headers: { Pragma: "no-cache" },
          }),
          fetch("/me/history?limit=20", {
            cache: "no-store",
            headers: { Pragma: "no-cache" },
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

        // Update SWR Cache
        if (globalThis.UXCore?.cache) {
          globalThis.UXCore.cache.set("subscriber_profile", sub);
        }

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
        const dashboardJournalCard = document.getElementById("dashboardJournalCard");
        if (dashboardJournalCard) {
          dashboardJournalCard.style.display = "block";
          loadDashboardJournal();
        }
        renderChannels(sub);
        renderCoachPersona(sub);
        renderOutboundWebhook(sub);
        loadActivityHeatmap();
        loadStreakFreezeStatus();
        historyCard.style.display = "block";
      } catch (err) {
        console.error(err);
        if (!currentSubscriber) {
          showError("Network error while loading your dashboard.");
        }
      }
    }

    preferencesForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      savePrefsBtn.disabled = true;
      saveStatus.textContent = "Saving preferences...";

      try {
        const cronValue =
          visualTimeSelect.value === "custom" ? prefCron.value.trim() : visualTimeSelect.value;

        const durationVal = prefFocusDuration ? Number(prefFocusDuration.value) || 25 : 25;
        const customQuoteVal = prefCustomQuote ? prefCustomQuote.value.trim() : null;
        const customRitualVal = prefCustomRitual ? prefCustomRitual.value.trim() : null;
        const newsCategoryVal = prefNewsCategory ? prefNewsCategory.value : "all";
        const weeklyDigestEnabledVal = prefWeeklyDigestEnabled
          ? prefWeeklyDigestEnabled.checked
          : true;
        const weeklyDigestDayVal = prefWeeklyDigestDay ? prefWeeklyDigestDay.value : "sunday";

        const body = {
          cronPattern: cronValue || "0 8 * * *",
          timezone: prefTz.value.trim() || "Asia/Kolkata",
          routineTrack: prefTrack.value || "deep-work",
          templateType: prefTrack.value || "deep-work",
          focusDurationMinutes: durationVal,
          customHabits: currentCustomHabits,
          customQuote: customQuoteVal,
          customRitual: customRitualVal,
          newsCategory: newsCategoryVal,
          weeklyDigestEnabled: weeklyDigestEnabledVal,
          weeklyDigestDay: weeklyDigestDayVal,
        };

        const resp = await fetch("/me", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Pragma: "no-cache",
          },
          body: JSON.stringify(body),
        });
        const data = await resp.json();

        if (!resp.ok) {
          saveStatus.textContent =
            data.error || (data.errors || []).join(", ") || "Failed to save.";
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

    // Focus duration preset listeners
    if (durationSelectBtns) {
      durationSelectBtns.forEach((btn) => {
        btn.addEventListener("click", function () {
          const mins = Number(this.getAttribute("data-mins"));
          setFocusDurationUI(mins);
        });
      });
    }

    if (prefFocusDuration) {
      prefFocusDuration.addEventListener("input", function () {
        setFocusDurationUI(this.value);
      });
    }

    // Custom habits event handlers
    function addCustomHabitFromInput() {
      if (!newHabitInput) return;
      const text = newHabitInput.value.trim();
      if (!text) return;
      if (currentCustomHabits.length >= 10) {
        showToast("Maximum 10 custom habits allowed.", "warn");
        return;
      }
      if (currentCustomHabits.includes(text)) {
        showToast("This habit is already in your checklist.", "info");
        return;
      }
      currentCustomHabits.push(text);
      newHabitInput.value = "";
      renderCustomHabitsList();
    }

    if (addHabitBtn) {
      addHabitBtn.addEventListener("click", addCustomHabitFromInput);
    }

    if (newHabitInput) {
      newHabitInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addCustomHabitFromInput();
        }
      });
    }

    if (customHabitsContainer) {
      customHabitsContainer.addEventListener("click", function (e) {
        const removeBtn = e.target.closest(".remove-habit-btn");
        if (removeBtn) {
          const idx = Number(removeBtn.getAttribute("data-index"));
          if (!isNaN(idx) && idx >= 0 && idx < currentCustomHabits.length) {
            currentCustomHabits.splice(idx, 1);
            renderCustomHabitsList();
          }
        }
      });
    }

    if (resetHabitsBtn) {
      resetHabitsBtn.addEventListener("click", function () {
        currentCustomHabits = [];
        renderCustomHabitsList();
        showToast("Reset habits to track defaults. Save to apply.", "info");
      });
    }

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
            Pragma: "no-cache",
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

    function urlBase64ToUint8Array(base64String) {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    async function syncNotificationState() {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        if (notificationCard) notificationCard.style.display = "block";
        if (notifStatusBadge) {
          notifStatusBadge.textContent = "Unsupported";
          notifStatusBadge.className = "status-badge paused";
        }
        if (enableNotifBtn) enableNotifBtn.disabled = true;
        if (notifNotice)
          notifNotice.textContent = "Push notifications are not supported in this browser.";
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
          enableNotifBtn.innerHTML = '<i class="fas fa-check"></i> Notifications Active';
          enableNotifBtn.className = "btn btn-success";
          enableNotifBtn.disabled = false;
        }
        if (testNotifBtn) testNotifBtn.style.display = "inline-flex";
        if (notifNotice)
          notifNotice.textContent =
            "✅ You will receive daily morning reminders when your routine goes live.";
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
        if (notifNotice)
          notifNotice.innerHTML =
            "⚠️ Notifications were blocked. To enable, click the lock icon in your browser URL bar and allow notifications.";
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
        if (notifNotice)
          notifNotice.textContent =
            "Allow notifications to receive wake-up alerts and streak reminders.";
      }
    }

    if (enableNotifBtn) {
      enableNotifBtn.addEventListener("click", async function () {
        try {
          const permission = await Notification.requestPermission();
          await syncNotificationState();

          if (permission !== "granted") {
            showToast("Notification permission was not granted.", "warn");
            return;
          }

          // Fetch VAPID public key
          const keyResp = await fetch("/api/push/vapid-public-key");
          if (keyResp.ok) {
            const { publicKey } = await keyResp.json();
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey),
            });

            await fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subscription }),
            });
          }

          showToast("🎉 Push notifications activated!", "success");
        } catch (err) {
          console.error("Failed to enable push notifications", err);
          showToast(err.message || "Failed to enable notifications.", "error");
        }
      });
    }

    if (testNotifBtn) {
      testNotifBtn.addEventListener("click", async function () {
        testNotifBtn.disabled = true;
        try {
          const resp = await fetch("/api/push/send-test", { method: "POST" });
          if (resp.ok) {
            showToast("Test notification sent! Check your screen.", "info");
          } else {
            // Local fallback test
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification("🌅 Time for your Morning Routine!", {
              body: "Your daily focus ritual is ready. Click to open your live timer & streak check-in.",
              icon: "/assets/mrn-brand-ico.png",
              badge: "/assets/mrn-brand-ico.png",
              tag: "morning-routine-test",
              renotify: true,
              data: { url: "/routine" },
            });
            showToast("Test notification dispatched locally.", "info");
          }
        } catch (err) {
          console.error("Test notification failed", err);
          showToast("Could not send test push.", "warn");
        } finally {
          testNotifBtn.disabled = false;
        }
      });
    }

    // --- 1-Click Checkin & Offline Sync Handler ---
    const dashboardCheckinBtn = document.getElementById("dashboardCheckinBtn");
    if (dashboardCheckinBtn) {
      dashboardCheckinBtn.addEventListener("click", async function () {
        if (!currentSubscriber?.email) return;

        // 1. Optimistic UI State
        const prevStreak = Number(currentSubscriber.streakCount) || 0;
        const optimisticStreak = prevStreak + 1;

        if (streakCountTitle) {
          streakCountTitle.textContent = `${optimisticStreak}-Day Streak Active 🔥`;
        }
        if (streakSubtext) {
          streakSubtext.textContent = `You're on day ${optimisticStreak} of building your daily morning routine. Consistency creates mastery!`;
        }
        dashboardCheckinBtn.innerHTML =
          '<i class="fas fa-check" aria-hidden="true"></i> Streak Maintained';
        dashboardCheckinBtn.disabled = true;

        // 2. Multi-sensory Feedback: Haptic + Audio + Confetti
        if (globalThis.UXCore?.haptics) {
          globalThis.UXCore.haptics.success();
        }
        if (globalThis.UXCore?.sound) {
          globalThis.UXCore.sound.playSuccess();
        }
        if (typeof globalThis.confetti === "function") {
          globalThis.confetti({
            particleCount: 80,
            spread: 65,
            origin: { y: 0.6 },
            colors: ["#10b981", "#6366f1", "#f59e0b"],
          });
        }
        if (globalThis.AppBadging) {
          globalThis.AppBadging.updateStreakBadge(optimisticStreak);
        }

        // 3. Offline Handling
        if (!navigator.onLine) {
          if (globalThis.OfflineSync) {
            globalThis.OfflineSync.queueCheckin({ email: currentSubscriber.email });
          }
          dashboardCheckinBtn.innerHTML =
            '<i class="fas fa-bolt" aria-hidden="true"></i> Queued for Sync';
          showToast("⚡ Check-in saved offline! Will sync automatically when reconnected.", "info");
          return;
        }

        try {
          const res = await fetch("/checkin?email=" + encodeURIComponent(currentSubscriber.email), {
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              Accept: "application/json",
            },
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success) {
            showToast("🔥 " + (data.title || "Check-in logged!"), "success");
            const finalStreak =
              data.streakCount !== undefined ? data.streakCount : optimisticStreak;
            currentSubscriber.streakCount = finalStreak;

            if (streakCountTitle) {
              streakCountTitle.textContent = `${finalStreak}-Day Streak Active 🔥`;
            }
            if (globalThis.AppBadging) {
              globalThis.AppBadging.updateStreakBadge(finalStreak);
            }

            // Invalidate SWR caches so fresh data is loaded
            if (globalThis.UXCore?.cache) {
              globalThis.UXCore.cache.invalidate("subscriber_profile");
              globalThis.UXCore.cache.invalidate("activity_heatmap_365");
            }

            // Trigger Milestone Celebration if milestone reached
            if (typeof globalThis.checkAndTriggerMilestoneCelebration === "function") {
              globalThis.checkAndTriggerMilestoneCelebration(finalStreak);
            }
          } else {
            // Rollback optimistic state gracefully
            showToast(
              data.message || "Check-in already completed today or verification failed.",
              "info",
            );
            dashboardCheckinBtn.disabled = false;
            dashboardCheckinBtn.innerHTML =
              '<i class="fas fa-check-circle" aria-hidden="true"></i> 1-Click Check-in';
            if (streakCountTitle) {
              streakCountTitle.textContent = `${prevStreak}-Day Streak Active 🔥`;
            }
          }
        } catch (_err) {
          if (globalThis.OfflineSync) {
            globalThis.OfflineSync.queueCheckin({ email: currentSubscriber.email });
          }
          dashboardCheckinBtn.innerHTML =
            '<i class="fas fa-bolt" aria-hidden="true"></i> Queued for Sync';
        }
      });
    }

    // --- Streak Freeze Shield Manager ---
    async function loadStreakFreezeStatus() {
      const freezeCard = document.getElementById("streakFreezeCard");
      const countBadge = document.getElementById("freezeShieldCountBadge");
      const useBtn = document.getElementById("useStreakFreezeBtn");
      if (!freezeCard) return;

      try {
        const resp = await fetch("/me/streak-freeze/status", { cache: "no-store" }).catch(() => ({
          ok: false,
        }));
        if (resp && resp.ok) {
          const data = await resp.json().catch(() => ({}));
          freezeCard.style.display = "flex";
          const remaining =
            typeof data.streakFreezesRemaining === "number" ? data.streakFreezesRemaining : 2;
          if (countBadge) {
            countBadge.textContent = `${remaining}/2 Shields Available`;
            if (remaining === 0) {
              countBadge.style.background = "rgba(239, 68, 68, 0.15)";
              countBadge.style.color = "#f87171";
              countBadge.style.borderColor = "rgba(239, 68, 68, 0.35)";
            }
          }
          if (useBtn && remaining === 0) {
            useBtn.disabled = true;
            useBtn.style.opacity = "0.5";
            useBtn.innerHTML =
              '<i class="fas fa-shield-alt" aria-hidden="true"></i> No Shields Left';
          }
        }
      } catch (_e) {
        // Non-blocking
      }
    }

    globalThis.useStreakFreezeShield = async function () {
      const useBtn = document.getElementById("useStreakFreezeBtn");
      if (useBtn) {
        useBtn.disabled = true;
        useBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Activating…';
      }

      try {
        const resp = await fetch("/me/streak-freeze/use", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch(() => ({ ok: false }));

        if (resp && resp.ok) {
          showToast(
            "🛡️ Streak Freeze Shield activated for today! Your streak is protected.",
            "success",
          );
          if (globalThis.UXCore?.sound) globalThis.UXCore.sound.playSuccess();
          if (globalThis.UXCore?.haptics) globalThis.UXCore.haptics.success();
          await loadStreakFreezeStatus();
        } else {
          const err = await resp.json().catch(() => ({}));
          showToast(err.error || "Could not activate streak freeze.", "error");
          if (useBtn) {
            useBtn.disabled = false;
            useBtn.innerHTML =
              '<i class="fas fa-shield-alt" aria-hidden="true"></i> Activate 24h Freeze';
          }
        }
      } catch (_e) {
        showToast("Network error while activating freeze shield.", "error");
        if (useBtn) {
          useBtn.disabled = false;
          useBtn.innerHTML =
            '<i class="fas fa-shield-alt" aria-hidden="true"></i> Activate 24h Freeze';
        }
      }
    };

    // --- Morning Mindset & Journaling State Manager ---
    let dashSelectedMood = 3;

    globalThis.setDashboardMood = function (score) {
      dashSelectedMood = score;
      const scoreInput = document.getElementById("dashMoodScore");
      if (scoreInput) scoreInput.value = score;

      document.querySelectorAll(".dash-mood-btn").forEach((btn) => {
        if (parseInt(btn.getAttribute("data-score"), 10) === score) {
          btn.style.background = "rgba(124, 58, 237, 0.35)";
          btn.style.borderColor = "var(--primary)";
        } else {
          btn.style.background = "rgba(0, 0, 0, 0.3)";
          btn.style.borderColor = "var(--border-subtle)";
        }
      });
    };

    async function loadDashboardJournal() {
      if (!currentSubscriber?.email) return;

      // SWR Cache Instant Hit
      if (globalThis.UXCore?.cache) {
        const cachedJournal = globalThis.UXCore.cache.get("journal_today", 30000);
        if (cachedJournal?.data?.entry) {
          const e = cachedJournal.data.entry;
          if (e.mood_score) globalThis.setDashboardMood(e.mood_score);
          const obt = document.getElementById("dashOneBigThing");
          if (obt && !obt.value) obt.value = e.one_big_thing || "";
          const grat = document.getElementById("dashGratitude");
          if (grat && !grat.value) grat.value = e.gratitude || "";
          const ref = document.getElementById("dashReflectionText");
          if (ref && !ref.value) ref.value = e.reflection_text || "";
        }
      }

      try {
        const res = await fetch("/api/journal/today", {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          if (globalThis.UXCore?.cache) {
            globalThis.UXCore.cache.set("journal_today", data);
          }
          if (data.entry) {
            if (data.entry.mood_score) globalThis.setDashboardMood(data.entry.mood_score);
            if (data.entry.one_big_thing) {
              const el = document.getElementById("dashOneBigThing");
              if (el) el.value = data.entry.one_big_thing;
            }
            if (data.entry.gratitude) {
              const el = document.getElementById("dashGratitude");
              if (el) el.value = data.entry.gratitude;
            }
            if (data.entry.reflection_text) {
              const el = document.getElementById("dashReflectionText");
              if (el) el.value = data.entry.reflection_text;
            }
            const statusEl = document.getElementById("dashJournalStatus");
            if (statusEl) statusEl.textContent = "Synced ✓";
          }
        }
      } catch (_e) {
        // Non-fatal if journal fetch fails
      }
    }

    globalThis.saveDashboardJournal = async function () {
      const saveBtn = document.getElementById("saveDashJournalBtn");
      const statusEl = document.getElementById("dashJournalStatus");
      const oneBigThing = document.getElementById("dashOneBigThing")?.value.trim() || "";
      const gratitude = document.getElementById("dashGratitude")?.value.trim() || "";
      const reflectionText = document.getElementById("dashReflectionText")?.value.trim() || "";

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Saving…';
      }

      const payload = {
        mood_score: dashSelectedMood,
        one_big_thing: oneBigThing,
        gratitude,
        reflection_text: reflectionText,
        track_key: currentSubscriber?.routineTrack || "deep-work",
      };

      // Optimistic Haptic & Audio Feedback
      if (globalThis.UXCore?.haptics) {
        globalThis.UXCore.haptics.light();
      }

      try {
        const res = await fetch("/api/journal/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          if (statusEl) statusEl.textContent = "Saved Just Now ✓";
          showToast("✨ Morning reflection saved!", "success");

          if (globalThis.UXCore?.sound) {
            globalThis.UXCore.sound.playSuccess();
          }

          if (globalThis.UXCore?.cache) {
            globalThis.UXCore.cache.set("journal_today", { entry: payload });
            globalThis.UXCore.cache.invalidate("activity_heatmap_365");
          }

          if (typeof globalThis.confetti === "function") {
            globalThis.confetti({
              particleCount: 60,
              spread: 60,
              origin: { y: 0.6 },
              colors: ["#6366f1", "#10b981", "#f59e0b"],
            });
          }
        } else {
          showToast(data.error || "Failed to save reflection.", "warn");
        }
      } catch (_err) {
        if (globalThis.OfflineSync?.queueJournal) {
          await globalThis.OfflineSync.queueJournal(payload);
          if (statusEl) statusEl.textContent = "Queued Offline ✓";
        } else {
          showToast("Network error. Saved locally.", "warn");
        }
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-save" aria-hidden="true"></i> Save Reflection';
        }
      }
    };

    // --- Multi-Channel Dispatch Handler ---
    const channelsCard = document.getElementById("channelsCard");
    const channelsForm = document.getElementById("channelsForm");
    const chanDiscord = document.getElementById("chanDiscord");
    const chanTelegram = document.getElementById("chanTelegram");
    const discordWebhookUrl = document.getElementById("discordWebhookUrl");
    const telegramChatId = document.getElementById("telegramChatId");
    const saveChannelsBtn = document.getElementById("saveChannelsBtn");
    const channelsSaveStatus = document.getElementById("channelsSaveStatus");
    const testDiscordBtn = document.getElementById("testDiscordBtn");
    const testTelegramBtn = document.getElementById("testTelegramBtn");

    function renderChannels(sub) {
      if (!channelsCard) return;
      channelsCard.style.display = "block";

      const enabled = (sub.channelsEnabled || sub.channels_enabled || "email").toLowerCase();
      if (chanDiscord) chanDiscord.checked = enabled.includes("discord");
      if (chanTelegram) chanTelegram.checked = enabled.includes("telegram");
      if (discordWebhookUrl)
        discordWebhookUrl.value = sub.discordWebhookUrl || sub.discord_webhook_url || "";
      if (telegramChatId) telegramChatId.value = sub.telegramChatId || sub.telegram_chat_id || "";
    }

    if (channelsForm) {
      channelsForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (saveChannelsBtn) saveChannelsBtn.disabled = true;
        if (channelsSaveStatus) channelsSaveStatus.textContent = "Saving channels...";

        const enabledList = ["email"];
        if (chanDiscord && chanDiscord.checked) enabledList.push("discord");
        if (chanTelegram && chanTelegram.checked) enabledList.push("telegram");

        try {
          const resp = await fetch("/me/channels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              discordWebhookUrl: discordWebhookUrl ? discordWebhookUrl.value.trim() : null,
              telegramChatId: telegramChatId ? telegramChatId.value.trim() : null,
              channelsEnabled: enabledList,
            }),
          });
          const data = await resp.json();

          if (!resp.ok) {
            if (channelsSaveStatus)
              channelsSaveStatus.textContent = data.error || "Failed to update channels.";
            showToast(data.error || "Channel update failed", "error");
            return;
          }

          if (channelsSaveStatus) channelsSaveStatus.textContent = "✅ Channels updated!";
          showToast("🎉 Multi-channel notification settings saved!", "success");
        } catch (err) {
          console.error("Channels update error", err);
          if (channelsSaveStatus) channelsSaveStatus.textContent = "Network error saving channels.";
          showToast("Network error. Please try again.", "error");
        } finally {
          if (saveChannelsBtn) saveChannelsBtn.disabled = false;
        }
      });
    }

    if (testDiscordBtn) {
      testDiscordBtn.addEventListener("click", async function () {
        const url = discordWebhookUrl ? discordWebhookUrl.value.trim() : "";
        if (!url) {
          showToast("Please enter a Discord Webhook URL first.", "warn");
          return;
        }

        testDiscordBtn.disabled = true;
        testDiscordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';

        try {
          const resp = await fetch("/api/channels/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel: "discord", webhookUrl: url }),
          });
          const data = await resp.json();

          if (resp.ok && data.success) {
            showToast(
              "✅ Discord test embed dispatched successfully! Check your channel.",
              "success",
            );
          } else {
            showToast(`❌ Discord test failed: ${data.error || "Unknown error"}`, "error");
          }
        } catch (_err) {
          showToast("Network error testing Discord dispatch.", "error");
        } finally {
          testDiscordBtn.disabled = false;
          testDiscordBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Test Discord';
        }
      });
    }

    if (testTelegramBtn) {
      testTelegramBtn.addEventListener("click", async function () {
        const chat = telegramChatId ? telegramChatId.value.trim() : "";
        if (!chat) {
          showToast("Please enter a Telegram Chat ID first.", "warn");
          return;
        }

        testTelegramBtn.disabled = true;
        testTelegramBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';

        try {
          const resp = await fetch("/api/channels/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel: "telegram", chatId: chat }),
          });
          const data = await resp.json();

          if (resp.ok && data.success) {
            showToast(
              "✅ Telegram message dispatched successfully! Check your Telegram.",
              "success",
            );
          } else {
            showToast(`❌ Telegram test failed: ${data.error || "Unknown error"}`, "error");
          }
        } catch (_err) {
          showToast("Network error testing Telegram dispatch.", "error");
        } finally {
          testTelegramBtn.disabled = false;
          testTelegramBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Test Telegram';
        }
      });
    }

    // --- Activity Heatmap Engine & Day Drawer ---
    const heatmapCard = document.getElementById("heatmapCard");
    const heatmapMonths = document.getElementById("heatmapMonths");
    const heatmapGrid = document.getElementById("heatmapGrid");
    const heatmapActiveDaysBadge = document.getElementById("heatmapActiveDaysBadge");
    const heatmapRateBadge = document.getElementById("heatmapRateBadge");
    const heatmapTooltip = document.getElementById("heatmapTooltip");
    const heatmapDrawer = document.getElementById("heatmapDrawer");
    const drawerBackdrop = document.getElementById("drawerBackdrop");
    const btnDrawerClose = document.getElementById("btnDrawerClose");
    const drawerTitle = document.getElementById("drawerTitle");
    const drawerBody = document.getElementById("drawerBody");

    const MOOD_LABEL_MAP = {
      1: "😫 Challenging (1/5)",
      2: "😕 Low Energy (2/5)",
      3: "😐 Steady / Balanced (3/5)",
      4: "🙂 Energized & Focused (4/5)",
      5: "⚡ Peak Flow & Momentum (5/5)",
    };

    function openHeatmapDrawer(dayData) {
      if (!heatmapDrawer) return;
      if (drawerTitle) drawerTitle.textContent = dayData.date;

      let html;
      if (!dayData.completed) {
        html = `
          <div style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.25); border-radius: 12px; padding: 18px; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 8px;">⏸️</div>
            <div style="font-weight: 700; color: #fff; font-size: 15px;">No Reflection Logged</div>
            <div class="small" style="color: var(--text-muted); margin-top: 4px;">No routine check-in or reflection was recorded for this date.</div>
          </div>
        `;
      } else {
        const moodText = MOOD_LABEL_MAP[dayData.moodScore] || `${dayData.moodScore}/5`;
        html = `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">Energy & Mindset State</span>
            <span class="status-badge active" style="font-size: 12px;">${moodText}</span>
          </div>
        `;

        if (dayData.oneBigThingSnippet) {
          html += `
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 16px;">
              <div style="font-size: 12px; font-weight: 700; color: #818cf8; text-transform: uppercase; margin-bottom: 6px;">🎯 Highest-Leverage Win</div>
              <div style="font-size: 14.5px; color: #fff; line-height: 1.45;">${dayData.oneBigThingSnippet}</div>
            </div>
          `;
        }

        if (dayData.hasGratitude) {
          html += `
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 16px;">
              <div style="font-size: 12px; font-weight: 700; color: #34d399; text-transform: uppercase; margin-bottom: 6px;">🙏 Gratitude</div>
              <div style="font-size: 14px; color: #cbd5e1; font-style: italic;">Recorded gratitude entry logged.</div>
            </div>
          `;
        }

        if (dayData.hasReflection) {
          html += `
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 16px;">
              <div style="font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 6px;">💭 Mindset Notes</div>
              <div style="font-size: 14px; color: #cbd5e1;">Detailed reflection notes recorded.</div>
            </div>
          `;
        }
      }

      if (drawerBody) drawerBody.innerHTML = html;
      heatmapDrawer.inert = false;
      heatmapDrawer.classList.add("open");
      heatmapDrawer.removeAttribute("aria-hidden");
    }

    function closeHeatmapDrawer() {
      if (!heatmapDrawer) return;
      if (document.activeElement && heatmapDrawer.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      heatmapDrawer.classList.remove("open");
      heatmapDrawer.setAttribute("aria-hidden", "true");
      heatmapDrawer.inert = true;
    }

    if (btnDrawerClose) btnDrawerClose.addEventListener("click", closeHeatmapDrawer);
    if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeHeatmapDrawer);

    async function loadActivityHeatmap() {
      if (!heatmapCard) return;

      // SWR Cache Instant Hit
      if (globalThis.UXCore?.cache) {
        const cachedHeatmap = globalThis.UXCore.cache.get("activity_heatmap_365", 60000);
        if (cachedHeatmap?.data) {
          const d = cachedHeatmap.data;
          heatmapCard.style.display = "block";
          if (heatmapActiveDaysBadge && d.summary) {
            heatmapActiveDaysBadge.textContent = `🔥 ${d.summary.totalActiveDays} Active Days`;
          }
          if (heatmapRateBadge && d.summary) {
            heatmapRateBadge.textContent = `📊 ${d.summary.completionRate} Consistency`;
          }
          renderHeatmapGrid(d.days || []);
        }
      }

      try {
        const res = await fetch("/api/journal/heatmap?days=365", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;

        if (globalThis.UXCore?.cache) {
          globalThis.UXCore.cache.set("activity_heatmap_365", data);
        }

        heatmapCard.style.display = "block";
        if (heatmapActiveDaysBadge && data.summary) {
          heatmapActiveDaysBadge.textContent = `🔥 ${data.summary.totalActiveDays} Active Days`;
        }
        if (heatmapRateBadge && data.summary) {
          heatmapRateBadge.textContent = `📊 ${data.summary.completionRate} Consistency`;
        }

        renderHeatmapGrid(data.days || []);
      } catch (_err) {
        // Non-fatal
      }
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    let cachedHeatmapData = null;

    function renderHeatmapGrid(days) {
      if (!heatmapGrid || !Array.isArray(days) || days.length === 0) return;

      const dataSignature = `${days.length}_${days[0]?.date}_${days[days.length - 1]?.date}_${days[days.length - 1]?.intensity}`;
      if (cachedHeatmapData === dataSignature && heatmapGrid.children.length > 0) return;
      cachedHeatmapData = dataSignature;

      // Render Month Headers using DocumentFragment
      if (heatmapMonths) {
        const monthFragment = document.createDocumentFragment();
        const leadingSpacer = document.createElement("span");
        monthFragment.appendChild(leadingSpacer);

        let lastMonth = -1;
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];

        for (let i = 0; i < days.length; i += 7) {
          const d = new Date(`${days[i].date}T00:00:00Z`);
          const m = d.getUTCMonth();
          const span = document.createElement("span");
          if (m !== lastMonth) {
            span.textContent = monthNames[m];
            lastMonth = m;
          }
          monthFragment.appendChild(span);
        }
        heatmapMonths.replaceChildren(monthFragment);
      }

      // Render Day Cells using DocumentFragment & Lookup Map
      const gridFragment = document.createDocumentFragment();
      const dayLookup = new Map();

      days.forEach((day, index) => {
        dayLookup.set(day.date, day);
        const cell = document.createElement("div");
        cell.className = `heatmap-cell level-${day.intensity || 0}`;
        cell.setAttribute("tabindex", "0");
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("data-date", day.date);
        cell.setAttribute("data-idx", String(index));
        cell.setAttribute(
          "aria-label",
          `${day.date}: ${day.completed ? `Active (Mood ${day.moodScore}/5)` : "No check-in"}`,
        );
        gridFragment.appendChild(cell);
      });

      heatmapGrid.replaceChildren(gridFragment);

      // Single Delegated Event Handler on parent container (0 closures allocated per cell)
      if (!heatmapGrid._delegatedBound) {
        heatmapGrid._delegatedBound = true;

        let activeTooltipCell = null;
        let tooltipRafId = null;

        heatmapGrid.addEventListener("mouseover", (e) => {
          const cell = e.target.closest(".heatmap-cell");
          if (!cell || cell === activeTooltipCell || !heatmapTooltip) return;
          activeTooltipCell = cell;

          const date = cell.getAttribute("data-date");
          const day = dayLookup.get(date);
          if (!day) return;

          const moodText = day.completed ? ` • Mood: ${day.moodScore}/5` : " • Inactive";
          const snippetText = day.oneBigThingSnippet
            ? `<br/>🎯 ${escapeHtml(day.oneBigThingSnippet)}`
            : "";

          if (tooltipRafId) cancelAnimationFrame(tooltipRafId);
          tooltipRafId = requestAnimationFrame(() => {
            heatmapTooltip.innerHTML = `<strong>${day.date}</strong>${moodText}${snippetText}`;
            const rect = cell.getBoundingClientRect();
            heatmapTooltip.style.left = `${rect.left + rect.width / 2}px`;
            heatmapTooltip.style.top = `${rect.top - 8}px`;
            heatmapTooltip.style.display = "block";
            heatmapTooltip.style.opacity = "1";
          });
        });

        heatmapGrid.addEventListener("mouseout", (e) => {
          const cell = e.target.closest(".heatmap-cell");
          if (!cell || !heatmapTooltip) return;
          activeTooltipCell = null;
          if (tooltipRafId) cancelAnimationFrame(tooltipRafId);
          heatmapTooltip.style.opacity = "0";
          heatmapTooltip.style.display = "none";
        });

        heatmapGrid.addEventListener("click", (e) => {
          const cell = e.target.closest(".heatmap-cell");
          if (!cell) return;
          const date = cell.getAttribute("data-date");
          const day = dayLookup.get(date);
          if (day) openHeatmapDrawer(day);
        });

        heatmapGrid.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            const cell = e.target.closest(".heatmap-cell");
            if (!cell) return;
            e.preventDefault();
            const date = cell.getAttribute("data-date");
            const day = dayLookup.get(date);
            if (day) openHeatmapDrawer(day);
          }
        });
      }
    }

    // --- AI Coach Persona Manager ---
    const coachPersonaCard = document.getElementById("coachPersonaCard");
    const personaGrid = document.getElementById("personaGrid");
    const prefCoachPersona = document.getElementById("prefCoachPersona");
    const activePersonaBadge = document.getElementById("activePersonaBadge");
    const saveCoachPersonaBtn = document.getElementById("saveCoachPersonaBtn");
    const coachPersonaSaveStatus = document.getElementById("coachPersonaSaveStatus");
    const customCoachPromptSection = document.getElementById("customCoachPromptSection");
    const customCoachPromptInput = document.getElementById("customCoachPromptInput");

    const PERSONA_BADGE_MAP = {
      stoic: "🏛️ Stoic Sage",
      relentless: "⚡ Relentless Operator",
      zen: "🧘 Zen Master",
      "tech-lead": "💻 Principal Architect",
      optimist: "☀️ Momentum Catalyst",
      custom: "✨ Personalized Mentor",
    };

    function selectCoachPersona(personaKey) {
      if (!personaKey) return;
      const norm = personaKey.toLowerCase().trim();
      if (prefCoachPersona) prefCoachPersona.value = norm;
      if (activePersonaBadge) {
        activePersonaBadge.textContent = PERSONA_BADGE_MAP[norm] || "🏛️ Stoic Sage";
      }

      if (customCoachPromptSection) {
        customCoachPromptSection.style.display = norm === "custom" ? "block" : "none";
      }

      document.querySelectorAll(".persona-card").forEach((card) => {
        const isMatch = card.getAttribute("data-persona") === norm;
        card.classList.toggle("selected", isMatch);
        card.setAttribute("aria-checked", isMatch ? "true" : "false");
        card.style.borderColor = isMatch ? "var(--primary)" : "var(--border-subtle)";
        card.style.boxShadow = isMatch ? "0 0 15px -3px var(--primary-glow)" : "none";
      });
    }

    function renderCoachPersona(sub) {
      if (!coachPersonaCard) return;
      coachPersonaCard.style.display = "block";
      const currentPersona = sub.coachPersona || sub.coach_persona || "stoic";
      selectCoachPersona(currentPersona);
      if (customCoachPromptInput) {
        customCoachPromptInput.value = sub.customCoachPrompt || "";
      }
    }

    if (personaGrid) {
      personaGrid.addEventListener("click", function (e) {
        const card = e.target.closest(".persona-card");
        if (card) selectCoachPersona(card.getAttribute("data-persona"));
      });
      personaGrid.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          const card = e.target.closest(".persona-card");
          if (card) {
            e.preventDefault();
            selectCoachPersona(card.getAttribute("data-persona"));
          }
        }
      });
    }

    if (saveCoachPersonaBtn) {
      saveCoachPersonaBtn.addEventListener("click", async function () {
        const persona = prefCoachPersona ? prefCoachPersona.value : "stoic";
        saveCoachPersonaBtn.disabled = true;
        if (coachPersonaSaveStatus)
          coachPersonaSaveStatus.textContent = "Updating coach persona...";

        try {
          const payload = { coachPersona: persona };
          if (customCoachPromptInput) {
            payload.customCoachPrompt = customCoachPromptInput.value.trim();
          }

          const resp = await fetch("/me/coach-persona", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await resp.json();

          if (!resp.ok) {
            if (coachPersonaSaveStatus)
              coachPersonaSaveStatus.textContent = data.error || "Failed to update.";
            showToast(data.error || "Persona update failed", "error");
            return;
          }

          if (coachPersonaSaveStatus) coachPersonaSaveStatus.textContent = "✅ Persona updated!";
          showToast(`🧠 AI Coach set to ${PERSONA_BADGE_MAP[persona] || persona}!`, "success");
        } catch (err) {
          console.error("Coach persona update error", err);
          if (coachPersonaSaveStatus) coachPersonaSaveStatus.textContent = "Network error.";
          showToast("Network error saving coach persona.", "error");
        } finally {
          saveCoachPersonaBtn.disabled = false;
        }
      });
    }

    // --- Outbound Webhook Automation Manager ---
    const outboundWebhookCard = document.getElementById("outboundWebhookCard");
    const outboundWebhookForm = document.getElementById("outboundWebhookForm");
    const outboundWebhookUrl = document.getElementById("outboundWebhookUrl");
    const outboundWebhookSecret = document.getElementById("outboundWebhookSecret");
    const outboundWebhookEnabled = document.getElementById("outboundWebhookEnabled");
    const saveWebhookBtn = document.getElementById("saveWebhookBtn");
    const testWebhookBtn = document.getElementById("testWebhookBtn");
    const webhookSaveStatus = document.getElementById("webhookSaveStatus");

    function renderOutboundWebhook(sub) {
      if (!outboundWebhookCard) return;
      outboundWebhookCard.style.display = "block";
      if (outboundWebhookUrl)
        outboundWebhookUrl.value = sub.webhookEndpointUrl || sub.webhook_endpoint_url || "";
      if (outboundWebhookSecret)
        outboundWebhookSecret.value = sub.webhookSecret || sub.webhook_secret || "";
      if (outboundWebhookEnabled) {
        outboundWebhookEnabled.checked = Boolean(
          sub.webhookEnabled !== undefined ? sub.webhookEnabled : sub.webhook_enabled,
        );
      }
    }

    if (outboundWebhookForm) {
      outboundWebhookForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (saveWebhookBtn) saveWebhookBtn.disabled = true;
        if (webhookSaveStatus) webhookSaveStatus.textContent = "Saving webhook settings...";

        const url = outboundWebhookUrl ? outboundWebhookUrl.value.trim() : "";
        const secret = outboundWebhookSecret ? outboundWebhookSecret.value.trim() : "";
        const enabled = outboundWebhookEnabled ? outboundWebhookEnabled.checked : false;

        try {
          const resp = await fetch("/me/outbound-webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              webhookEndpointUrl: url || null,
              webhookSecret: secret || null,
              webhookEnabled: enabled,
            }),
          });
          const data = await resp.json();

          if (!resp.ok) {
            if (webhookSaveStatus)
              webhookSaveStatus.textContent = data.error || "Failed to update webhook.";
            showToast(data.error || "Webhook update failed", "error");
            return;
          }

          if (webhookSaveStatus) webhookSaveStatus.textContent = "✅ Webhook settings saved!";
          showToast("🔌 Outbound webhook automation configured!", "success");
        } catch (err) {
          console.error("Outbound webhook update error", err);
          if (webhookSaveStatus) webhookSaveStatus.textContent = "Network error.";
          showToast("Network error saving webhook settings.", "error");
        } finally {
          if (saveWebhookBtn) saveWebhookBtn.disabled = false;
        }
      });
    }

    if (testWebhookBtn) {
      testWebhookBtn.addEventListener("click", async function () {
        const url = outboundWebhookUrl ? outboundWebhookUrl.value.trim() : "";
        const secret = outboundWebhookSecret ? outboundWebhookSecret.value.trim() : "";

        if (!url) {
          showToast("Please provide a Webhook Destination URL first.", "warn");
          return;
        }

        testWebhookBtn.disabled = true;
        testWebhookBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ping...';

        try {
          const resp = await fetch("/api/outbound-webhook/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ webhookEndpointUrl: url, webhookSecret: secret }),
          });
          const data = await resp.json();

          if (resp.ok && data.success) {
            showToast("✅ Outbound webhook test ping delivered successfully!", "success");
          } else {
            showToast(`❌ Webhook ping failed: ${data.error || "Unknown error"}`, "error");
          }
        } catch (_err) {
          showToast("Network error testing webhook ping.", "error");
        } finally {
          testWebhookBtn.disabled = false;
          testWebhookBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Test Ping';
        }
      });
    }

    // --- Social Streak Share Modal Controller ---
    const streakShareModal = document.getElementById("streakShareModal");
    const openShareModalBtn = document.getElementById("openShareModalBtn");
    const closeShareModalBtn = document.getElementById("closeShareModalBtn");
    const shareCardPreviewImg =
      document.getElementById("shareCardPreviewImg") ||
      document.getElementById("modalStreakPreviewImg");
    const shareTwitterBtn = document.getElementById("shareTwitterBtn");
    const shareLinkedinBtn = document.getElementById("shareLinkedinBtn");
    const copyShareLinkBtn = document.getElementById("copyShareLinkBtn");
    const copyMarkdownBadgeBtn = document.getElementById("copyMarkdownBadgeBtn");
    const shareTabStreak = document.getElementById("shareTabStreak");
    const shareTabWeekly = document.getElementById("shareTabWeekly");
    const subscribeWebcalBtn = document.getElementById("subscribeWebcalBtn");

    let currentShareCardMode = "streak";

    function renderShareCardMode(mode) {
      currentShareCardMode = mode;
      const streak = currentSubscriber?.streakCount || 1;
      const email = currentSubscriber?.email || "subscriber";
      const track = currentSubscriber?.routineTrack || "deep-work";
      const officialDomain = window.location.origin;

      if (shareTabStreak && shareTabWeekly) {
        if (mode === "streak") {
          shareTabStreak.className = "btn btn-sm btn-primary";
          shareTabWeekly.className = "btn btn-sm btn-secondary";
        } else {
          shareTabStreak.className = "btn btn-sm btn-secondary";
          shareTabWeekly.className = "btn btn-sm btn-primary";
        }
      }

      if (mode === "streak") {
        const svgCardUrl = `${officialDomain}/api/streak-card.svg?email=${encodeURIComponent(email)}&streak=${streak}&track=${encodeURIComponent(track)}`;
        const streakShareUrl = `${officialDomain}/streak/${encodeURIComponent(email)}`;
        if (shareCardPreviewImg) {
          shareCardPreviewImg.src = svgCardUrl;
          shareCardPreviewImg.alt = "Streak Momentum Card";
        }
        const tweetText = encodeURIComponent(
          `🔥 Locked in a ${streak}-day unbroken morning routine streak on Morning Routine Sender! ⚡ Leveling up deep work & mental clarity every single morning. Check out my streak:`,
        );
        const encodedShareUrl = encodeURIComponent(streakShareUrl);
        if (shareTwitterBtn) {
          shareTwitterBtn.href = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodedShareUrl}&hashtags=MorningRoutine,DeepWork,Habits,Discipline`;
        }
        if (shareLinkedinBtn) {
          shareLinkedinBtn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareUrl}`;
        }
      } else {
        const weeklyReportUrl = `${officialDomain}/api/weekly-report/${encodeURIComponent(email)}/card.svg`;
        const streakShareUrl = `${officialDomain}/streak/${encodeURIComponent(email)}?view=weekly`;
        if (shareCardPreviewImg) {
          shareCardPreviewImg.src = weeklyReportUrl;
          shareCardPreviewImg.alt = "Weekly Habit Scorecard";
        }
        const tweetText = encodeURIComponent(
          `📊 Verified my Weekly Habit Consistency Scorecard on Morning Routine Sender! ⚡ Unbroken discipline, high consistency & peak morning momentum:`,
        );
        const encodedShareUrl = encodeURIComponent(streakShareUrl);
        if (shareTwitterBtn) {
          shareTwitterBtn.href = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodedShareUrl}&hashtags=MorningRoutine,Consistency,Habits,Growth`;
        }
        if (shareLinkedinBtn) {
          shareLinkedinBtn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareUrl}`;
        }
      }
    }

    if (shareTabStreak) {
      shareTabStreak.addEventListener("click", () => renderShareCardMode("streak"));
    }
    if (shareTabWeekly) {
      shareTabWeekly.addEventListener("click", () => renderShareCardMode("weekly"));
    }

    function openStreakShareModal() {
      if (!streakShareModal) return;
      renderShareCardMode(currentShareCardMode || "streak");
      streakShareModal.inert = false;
      streakShareModal.style.display = "flex";
      streakShareModal.removeAttribute("aria-hidden");
    }

    function closeStreakShareModal() {
      if (!streakShareModal) return;
      if (document.activeElement && streakShareModal.contains(document.activeElement)) {
        if (openShareModalBtn && typeof openShareModalBtn.focus === "function") {
          openShareModalBtn.focus();
        } else {
          document.activeElement.blur();
        }
      }
      streakShareModal.style.display = "none";
      streakShareModal.setAttribute("aria-hidden", "true");
      streakShareModal.inert = true;
    }

    if (openShareModalBtn) openShareModalBtn.addEventListener("click", openStreakShareModal);
    if (closeShareModalBtn) closeShareModalBtn.addEventListener("click", closeStreakShareModal);
    if (streakShareModal) {
      streakShareModal.addEventListener("click", function (e) {
        if (e.target === streakShareModal) closeStreakShareModal();
      });
    }

    if (copyShareLinkBtn) {
      copyShareLinkBtn.addEventListener("click", function () {
        const email = currentSubscriber?.email || "subscriber";
        const shareUrl =
          currentShareCardMode === "weekly"
            ? `${window.location.origin}/streak/${encodeURIComponent(email)}?view=weekly`
            : `${window.location.origin}/streak/${encodeURIComponent(email)}`;

        navigator.clipboard
          .writeText(shareUrl)
          .then(() => {
            showToast(
              currentShareCardMode === "weekly"
                ? "📋 Weekly Scorecard link copied to clipboard!"
                : "📋 Public Streak Share link copied to clipboard!",
              "success",
            );
          })
          .catch(() => {
            showToast("Failed to copy link.", "warn");
          });
      });
    }

    if (copyMarkdownBadgeBtn) {
      copyMarkdownBadgeBtn.addEventListener("click", function () {
        const email = currentSubscriber?.email || "subscriber";
        let markdownBadge;
        if (currentShareCardMode === "weekly") {
          const svgUrl = `${window.location.origin}/api/weekly-report/${encodeURIComponent(email)}/card.svg`;
          const shareUrl = `${window.location.origin}/streak/${encodeURIComponent(email)}?view=weekly`;
          markdownBadge = `[![Weekly Habit Scorecard](${svgUrl})](${shareUrl})`;
        } else {
          const svgUrl = `${window.location.origin}/api/streak-card/${encodeURIComponent(email)}/card.svg`;
          const streakShareUrl = `${window.location.origin}/streak/${encodeURIComponent(email)}`;
          markdownBadge = `[![Morning Routine Streak](${svgUrl})](${streakShareUrl})`;
        }

        navigator.clipboard
          .writeText(markdownBadge)
          .then(() => {
            showToast("📋 GitHub Markdown badge code copied to clipboard!", "success");
          })
          .catch(() => {
            showToast("Failed to copy badge.", "warn");
          });
      });
    }

    if (subscribeWebcalBtn) {
      subscribeWebcalBtn.addEventListener("click", function () {
        const domain = window.location.origin;
        const webcalUrl =
          currentSubscriber?.webcalUrl ||
          (currentSubscriber?.calendarFeedUrl
            ? currentSubscriber.calendarFeedUrl.replace(/^https?:\/\//i, "webcal://")
            : `${domain.replace(/^https?:\/\//i, "webcal://")}/me/calendar.ics`);

        navigator.clipboard
          .writeText(webcalUrl)
          .then(() => {
            showToast(
              "📅 <b>Webcal Feed Copied!</b> Paste into Apple Calendar, Google Calendar, or Outlook for live automatic syncing.",
              "success",
              { duration: 6000, allowHtml: true },
            );
          })
          .catch(() => {
            showToast(`Webcal Feed: ${webcalUrl}`, "info");
          });

        try {
          window.location.href = webcalUrl;
        } catch (_e) {
          /* Browser might not handle webcal: URI scheme directly */
        }
      });
    }

    // ==========================================
    // 1. Milestone Celebration Controller
    // ==========================================
    const MILESTONE_TIERS = {
      3: {
        title: "3-Day Ignition Spark",
        subtitle:
          "The spark has caught fire! You've broken inertia and begun your daily morning ritual.",
        tierName: "Spark Initiate",
        tierMultiplier: "Top 40%",
        icon: "fa-bolt",
        flame: "⚡",
        colors: ["#f59e0b", "#fbbf24", "#ef4444"],
      },
      7: {
        title: "7-Day Routine Warrior",
        subtitle:
          "One full unbroken week! You've successfully established neurological morning rhythm.",
        tierName: "Week 1 Champion",
        tierMultiplier: "Top 25%",
        icon: "fa-shield-halved",
        flame: "🛡️",
        colors: ["#3b82f6", "#06b6d4", "#60a5fa"],
      },
      14: {
        title: "14-Day Habit Builder",
        subtitle:
          "Two solid weeks of continuous momentum. Discipline is rapidly transforming into second nature.",
        tierName: "Habit Vanguard",
        tierMultiplier: "Top 15%",
        icon: "fa-seedling",
        flame: "⚔️",
        colors: ["#10b981", "#34d399", "#059669"],
      },
      30: {
        title: "30-Day Spartan Master",
        subtitle:
          "A whole month of unwavering dedication! You belong to the top 5% of elite morning ritualists.",
        tierName: "Monthly Spartan",
        tierMultiplier: "Top 5%",
        icon: "fa-trophy",
        flame: "🏆",
        colors: ["#f59e0b", "#f97316", "#ef4444"],
      },
      60: {
        title: "60-Day Unstoppable Force",
        subtitle:
          "Two months of daily discipline. Your morning routine is now your primary unfair competitive advantage.",
        tierName: "Diamond Titan",
        tierMultiplier: "Top 2%",
        icon: "fa-gem",
        flame: "💎",
        colors: ["#06b6d4", "#a855f7", "#3b82f6"],
      },
      100: {
        title: "100-Day Centurion Legend",
        subtitle:
          "Triple-digit mastery achieved! 100 intentional mornings designed for peak clarity and purpose.",
        tierName: "Centurion Master",
        tierMultiplier: "Top 1%",
        icon: "fa-crown",
        flame: "👑",
        colors: ["#f43f5e", "#fb7185", "#e11d48"],
      },
      365: {
        title: "365-Day Immortal Grandmaster",
        subtitle:
          "A complete 365-day solar orbit of unbroken discipline. You have ascended to legendary habit immortality!",
        tierName: "Immortal Legend",
        tierMultiplier: "Top 0.1%",
        icon: "fa-star",
        flame: "🌟",
        colors: ["#a855f7", "#ec4899", "#f59e0b", "#10b981"],
      },
    };

    const milestoneModal = document.getElementById("milestoneModal");
    const closeMilestoneModalBtn = document.getElementById("closeMilestoneModalBtn");
    const milestoneDismissBtn = document.getElementById("milestoneDismissBtn");
    const milestoneShareBtn = document.getElementById("milestoneShareBtn");

    function fireMilestoneConfetti(colors) {
      if (typeof globalThis.confetti !== "function") return;
      const confettiColors = colors || ["#f59e0b", "#10b981", "#6366f1"];

      globalThis.confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: confettiColors,
      });

      globalThis.confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: confettiColors,
      });

      setTimeout(() => {
        globalThis.confetti({
          particleCount: 100,
          spread: 100,
          origin: { y: 0.4 },
          colors: confettiColors,
        });
      }, 250);
    }

    function openMilestoneCelebration(streakCount) {
      const config = MILESTONE_TIERS[streakCount];
      if (!config || !milestoneModal) return;

      const titleEl = document.getElementById("milestoneTitle");
      const descEl = document.getElementById("milestoneDescription");
      const tierNameEl = document.getElementById("milestoneTierName");
      const countEl = document.getElementById("milestoneStreakCount");
      const multEl = document.getElementById("milestoneTierMultiplier");
      const flameEl = document.getElementById("milestoneFlameIcon");
      const tierIcon = document.getElementById("milestoneTierIcon");

      if (titleEl) titleEl.textContent = config.title;
      if (descEl) descEl.textContent = config.subtitle;
      if (tierNameEl) tierNameEl.textContent = config.tierName;
      if (countEl) countEl.textContent = streakCount;
      if (multEl) multEl.textContent = config.tierMultiplier;
      if (flameEl) flameEl.textContent = config.flame;
      if (tierIcon) tierIcon.className = `fas ${config.icon}`;

      milestoneModal.inert = false;
      milestoneModal.style.display = "flex";
      requestAnimationFrame(() => {
        milestoneModal.classList.add("active");
        milestoneModal.removeAttribute("aria-hidden");
      });

      fireMilestoneConfetti(config.colors);
      if (globalThis.UXCore?.sound) {
        globalThis.UXCore.sound.playMilestone();
      }
      if (globalThis.UXCore?.haptics) {
        globalThis.UXCore.haptics.celebration();
      }
    }

    function closeMilestoneModal() {
      if (!milestoneModal) return;
      if (document.activeElement && milestoneModal.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      milestoneModal.classList.remove("active");
      milestoneModal.setAttribute("aria-hidden", "true");
      milestoneModal.inert = true;
      setTimeout(() => {
        milestoneModal.style.display = "none";
      }, 300);
    }

    if (closeMilestoneModalBtn)
      closeMilestoneModalBtn.addEventListener("click", closeMilestoneModal);
    if (milestoneDismissBtn) milestoneDismissBtn.addEventListener("click", closeMilestoneModal);
    if (milestoneModal) {
      milestoneModal.addEventListener("click", (e) => {
        if (e.target === milestoneModal) closeMilestoneModal();
      });
    }

    if (milestoneShareBtn) {
      milestoneShareBtn.addEventListener("click", () => {
        closeMilestoneModal();
        openStreakShareModal();
      });
    }

    globalThis.checkAndTriggerMilestoneCelebration = function (streakCount) {
      const streak = Number(streakCount);
      if (!MILESTONE_TIERS[streak]) return;

      const storageKey = `mrn_milestone_celebrated_${streak}`;
      try {
        if (localStorage.getItem(storageKey)) return;
        localStorage.setItem(storageKey, new Date().toISOString());
      } catch (_e) {
        // Non-fatal storage error
      }
      openMilestoneCelebration(streak);
    };

    // ==========================================
    // 2. Keyboard Shortcuts Cheat Sheet Controller
    // ==========================================
    const shortcutsModal = document.getElementById("shortcutsModal");
    const closeShortcutsModalBtn = document.getElementById("closeShortcutsModalBtn");

    function openShortcutsModal() {
      if (!shortcutsModal) return;
      shortcutsModal.inert = false;
      shortcutsModal.style.display = "flex";
      requestAnimationFrame(() => {
        shortcutsModal.classList.add("active");
        shortcutsModal.removeAttribute("aria-hidden");
      });
    }

    function closeShortcutsModal() {
      if (!shortcutsModal) return;
      if (document.activeElement && shortcutsModal.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      shortcutsModal.classList.remove("active");
      shortcutsModal.setAttribute("aria-hidden", "true");
      shortcutsModal.inert = true;
      setTimeout(() => {
        shortcutsModal.style.display = "none";
      }, 250);
    }

    function closeAllModals() {
      closeShortcutsModal();
      closeMilestoneModal();
      closeStreakShareModal();
      if (typeof closeHeatmapDrawer === "function") {
        closeHeatmapDrawer();
      }
    }

    if (closeShortcutsModalBtn)
      closeShortcutsModalBtn.addEventListener("click", closeShortcutsModal);
    if (shortcutsModal) {
      shortcutsModal.addEventListener("click", (e) => {
        if (e.target === shortcutsModal) closeShortcutsModal();
      });
    }

    function scrollToSection(targetId) {
      const el = document.getElementById(targetId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.remove("section-flash-highlight");
      void el.offsetWidth;
      el.classList.add("section-flash-highlight");
    }

    // Initialize UXCore shortcuts
    if (globalThis.UXCore?.shortcuts) {
      globalThis.UXCore.shortcuts.init({
        " ": () => {
          if (dashboardCheckinBtn && !dashboardCheckinBtn.disabled) {
            dashboardCheckinBtn.click();
          }
        },
        c: () => {
          if (dashboardCheckinBtn && !dashboardCheckinBtn.disabled) {
            dashboardCheckinBtn.click();
          }
        },
        j: () => {
          scrollToSection("dashboardJournalCard");
          const input =
            document.getElementById("dashOneBigThing") ||
            document.getElementById("dashReflectionText");
          if (input) setTimeout(() => input.focus(), 350);
        },
        h: () => {
          scrollToSection("heatmapCard");
        },
        s: () => {
          openStreakShareModal();
        },
        "?": () => {
          if (shortcutsModal && shortcutsModal.classList.contains("active")) {
            closeShortcutsModal();
          } else {
            openShortcutsModal();
          }
        },
        Escape: () => {
          closeAllModals();
        },
      });
    }

    // ==========================================
    // 3. Mobile Bottom Navigation Controller
    // ==========================================
    // ==========================================
    // 3. Mobile Bottom Navigation Controller
    // ==========================================
    const navTabs = document.querySelectorAll(".mobile-nav-tab[data-target]");
    navTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetId = tab.getAttribute("data-target");
        if (globalThis.UXCore?.haptics) {
          globalThis.UXCore.haptics.light();
        }

        navTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        if (targetId === "dashboardMain") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          scrollToSection(targetId);
        }
      });
    });

    if (typeof IntersectionObserver !== "undefined") {
      const sectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && window.innerWidth < 768) {
              const targetId = entry.target.id;
              navTabs.forEach((tab) => {
                tab.classList.toggle("active", tab.getAttribute("data-target") === targetId);
              });
            }
          });
        },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0.1 },
      );

      ["dashboardMain", "heatmapCard", "dashboardJournalCard"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) sectionObserver.observe(el);
      });
    }

    // ==========================================
    // 4. Voice Briefing & Visualizer Controller
    // ==========================================
    const voiceBriefingBtn = document.getElementById("voiceBriefingBtn");
    const voiceBriefingIcon = document.getElementById("voiceBriefingIcon");
    const voiceBriefingText = document.getElementById("voiceBriefingText");
    const voiceWaveVisualizer = document.getElementById("voiceWaveVisualizer");

    const cachedVisualizerBars = [0, 1, 2, 3, 4].map((idx) =>
      document.getElementById(`vbar-${idx}`),
    );

    if (globalThis.UXCore?.voice) {
      globalThis.UXCore.voice.setVisualizer((bars) => {
        for (let i = 0; i < 5; i++) {
          const barEl = cachedVisualizerBars[i];
          if (barEl) {
            barEl.style.transform = `scaleY(${Math.max(0.2, bars[i] || 0)})`;
          }
        }
      });
    }

    if (voiceBriefingBtn) {
      voiceBriefingBtn.addEventListener("click", () => {
        if (!globalThis.UXCore?.voice) {
          showToast("Voice synthesis is not supported on this browser.", "info");
          return;
        }

        if (globalThis.UXCore.voice.isSpeaking()) {
          globalThis.UXCore.voice.stop();
          if (voiceBriefingIcon) voiceBriefingIcon.className = "fas fa-volume-up";
          if (voiceBriefingText) voiceBriefingText.textContent = "Voice Spark";
          if (voiceWaveVisualizer) voiceWaveVisualizer.style.display = "none";
          return;
        }

        // Get coaching spark text from active persona card or quote
        const activeCard = document.querySelector(".persona-card.selected");
        const quoteEl = activeCard ? activeCard.querySelector("div:last-child") : null;
        const coachTitle = activeCard
          ? activeCard.querySelector("div:first-child > div")?.textContent
          : "Stoic Sage";
        const quoteText = quoteEl
          ? quoteEl.textContent.replace(/["']/g, "")
          : "You have power over your mind, not outside events. Realize this, and you will find great strength.";

        const briefing = `Good morning. Here is your coaching spark from the ${coachTitle}: ${quoteText}. Focus on your One Big Thing and lead your day with intention.`;

        if (voiceBriefingIcon) voiceBriefingIcon.className = "fas fa-stop";
        if (voiceBriefingText) voiceBriefingText.textContent = "Stop";
        if (voiceWaveVisualizer) voiceWaveVisualizer.style.display = "inline-flex";

        globalThis.UXCore.voice.speak(briefing, () => {
          if (voiceBriefingIcon) voiceBriefingIcon.className = "fas fa-volume-up";
          if (voiceBriefingText) voiceBriefingText.textContent = "Voice Spark";
          if (voiceWaveVisualizer) voiceWaveVisualizer.style.display = "none";
        });
      });
    }

    // ==========================================
    // 5. Procedural Ambient Soundscapes Controller
    // ==========================================
    const ambientSoundBtn = document.getElementById("ambientSoundBtn");
    const ambientSoundLabel = document.getElementById("ambientSoundLabel");
    const ambientModes = ["off", "binaural", "rain", "zen-waves"];
    const ambientLabels = {
      off: "Ambient: Off",
      binaural: "Alpha Waves (10Hz) 🎧",
      rain: "Rain Focus 🌧️",
      "zen-waves": "Zen Ocean 🌊",
    };
    let currentAmbientIdx = 0;

    if (ambientFreqSelect) {
      ambientFreqSelect.addEventListener("change", function () {
        const hz = Number(this.value);
        if (globalThis.UXCore?.ambient?.setBinauralBeat) {
          globalThis.UXCore.ambient.setBinauralBeat(hz);
          const nameMap = {
            6: "Theta (6Hz)",
            10: "Alpha (10Hz)",
            18: "Beta (18Hz)",
            40: "Gamma (40Hz)",
          };
          ambientLabels.binaural = `${nameMap[hz] || hz + "Hz"} 🎧`;
          if (ambientModes[currentAmbientIdx] === "binaural" && ambientSoundLabel) {
            ambientSoundLabel.textContent = ambientLabels.binaural;
          }
        }
      });
    }

    const ambientVolumeRange = document.getElementById("ambientVolumeRange");
    if (ambientVolumeRange) {
      if (globalThis.UXCore?.ambient?.getVolume) {
        ambientVolumeRange.value = Math.round(globalThis.UXCore.ambient.getVolume() * 100);
      }
      ambientVolumeRange.addEventListener("input", function () {
        const vol = Number(this.value) / 100;
        if (globalThis.UXCore?.ambient?.setVolume) {
          globalThis.UXCore.ambient.setVolume(vol);
        }
      });
    }

    if (ambientSoundBtn) {
      ambientSoundBtn.addEventListener("click", () => {
        if (!globalThis.UXCore?.ambient) return;
        currentAmbientIdx = (currentAmbientIdx + 1) % ambientModes.length;
        const targetMode = ambientModes[currentAmbientIdx];

        if (targetMode === "off") {
          globalThis.UXCore.ambient.stop();
          if (ambientSoundLabel) ambientSoundLabel.textContent = ambientLabels.off;
          ambientSoundBtn.classList.remove("btn-primary");
          ambientSoundBtn.classList.add("btn-secondary");
        } else {
          const currentVol = globalThis.UXCore.ambient.getVolume
            ? globalThis.UXCore.ambient.getVolume()
            : 0.45;
          globalThis.UXCore.ambient.play(targetMode, currentVol);
          if (ambientSoundLabel) ambientSoundLabel.textContent = ambientLabels[targetMode];
          ambientSoundBtn.classList.remove("btn-secondary");
          ambientSoundBtn.classList.add("btn-primary");
          if (globalThis.UXCore?.sound) globalThis.UXCore.sound.playClick();
        }
      });
    }

    // ==========================================
    // 6. Interactive Spotlight Onboarding Tour
    // ==========================================
    const startTourBtn = document.getElementById("startTourBtn");
    if (startTourBtn) {
      startTourBtn.addEventListener("click", () => {
        if (globalThis.UXCore?.tour) {
          globalThis.UXCore.tour.start(true);
        }
      });
    }

    // ==========================================
    // 7. Journal Micro-Interactions & Auto-Expand
    // ==========================================
    const reflectionTextarea = document.getElementById("dashReflectionText");
    const gratitudeInput = document.getElementById("dashGratitude");
    const oneBigThingInput = document.getElementById("dashOneBigThing");
    const dashJournalForm = document.getElementById("dashJournalForm");

    if (dashJournalForm) {
      dashJournalForm.addEventListener("submit", (e) => {
        e.preventDefault();
        globalThis.saveDashboardJournal();
      });
    }

    let journalInputTimer = null;
    const journalStatusEl = document.getElementById("dashJournalStatus");

    [reflectionTextarea].forEach((ta) => {
      if (!ta) return;
      ta.addEventListener("input", function () {
        const el = this;
        if (journalInputTimer) clearTimeout(journalInputTimer);
        journalInputTimer = setTimeout(() => {
          requestAnimationFrame(() => {
            el.style.height = "auto";
            el.style.height = `${Math.max(80, el.scrollHeight)}px`;
            const text = el.value.trim();
            const words = text ? text.split(/\s+/).length : 0;
            if (journalStatusEl && words > 10) {
              journalStatusEl.textContent = "Thoughtful Reflection ✓";
            }
          });
        }, 100);
      });

      ta.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          globalThis.saveDashboardJournal();
        }
      });
    });

    [oneBigThingInput, gratitudeInput].forEach((inp) => {
      if (!inp) return;
      inp.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          globalThis.saveDashboardJournal();
        }
      });
    });

    // ==========================================
    // 8. Mobile Action Dock Controller
    // ==========================================
    const dockCheckinBtn = document.getElementById("dockCheckinBtn");
    const dockTimerBtn = document.getElementById("dockTimerBtn");
    const dockAmbientBtn = document.getElementById("dockAmbientBtn");
    const dockJournalBtn = document.getElementById("dockJournalBtn");
    const dockPrefsBtn = document.getElementById("dockPrefsBtn");

    if (dockCheckinBtn) {
      dockCheckinBtn.addEventListener("click", () => {
        if (globalThis.UXCore?.haptics) globalThis.UXCore.haptics.medium();
        if (
          dashboardCheckinBtn &&
          !dashboardCheckinBtn.disabled &&
          dashboardCheckinBtn.offsetParent !== null
        ) {
          dashboardCheckinBtn.click();
        } else {
          scrollToSection("streakHeroCard");
        }
      });
    }

    if (dockTimerBtn) {
      dockTimerBtn.addEventListener("click", () => {
        if (globalThis.UXCore?.haptics) globalThis.UXCore.haptics.light();
        window.location.href = "/routine";
      });
    }

    if (dockAmbientBtn) {
      dockAmbientBtn.addEventListener("click", () => {
        if (globalThis.UXCore?.haptics) globalThis.UXCore.haptics.light();
        if (ambientSoundBtn) {
          ambientSoundBtn.click();
        } else {
          scrollToSection("coachPersonaCard");
        }
      });
    }

    if (dockJournalBtn) {
      dockJournalBtn.addEventListener("click", () => {
        if (globalThis.UXCore?.haptics) globalThis.UXCore.haptics.light();
        scrollToSection("dashboardJournalCard");
        const input =
          document.getElementById("dashOneBigThing") ||
          document.getElementById("dashReflectionText");
        if (input) setTimeout(() => input.focus(), 350);
      });
    }

    if (dockPrefsBtn) {
      dockPrefsBtn.addEventListener("click", () => {
        if (globalThis.UXCore?.haptics) globalThis.UXCore.haptics.light();
        scrollToSection("subscriptionCard");
      });
    }

    loadDashboard();
    syncNotificationState();
  })();
});
