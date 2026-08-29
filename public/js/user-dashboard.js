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
        historyList.innerHTML =
          '<p class="meta" style="margin:0">No dispatch history recorded yet.</p>';
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

        if (!navigator.onLine) {
          if (globalThis.OfflineSync) {
            globalThis.OfflineSync.queueCheckin({ email: currentSubscriber.email });
          }
          dashboardCheckinBtn.innerHTML =
            '<i class="fas fa-bolt" aria-hidden="true"></i> Queued for Sync';
          return;
        }

        dashboardCheckinBtn.disabled = true;
        dashboardCheckinBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Checking in…';

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
            if (data.streakCount) {
              streakCountTitle.textContent = `${data.streakCount}-Day Streak Active 🔥`;
            }
            dashboardCheckinBtn.innerHTML =
              '<i class="fas fa-check" aria-hidden="true"></i> Streak Maintained';
            if (typeof globalThis.confetti === "function") {
              globalThis.confetti({
                particleCount: 75,
                spread: 60,
                origin: { y: 0.6 },
                colors: ["#10b981", "#6366f1", "#f59e0b"],
              });
            }
          } else {
            showToast(data.message || "Failed to log check-in.", "warn");
            dashboardCheckinBtn.disabled = false;
            dashboardCheckinBtn.innerHTML =
              '<i class="fas fa-check-circle" aria-hidden="true"></i> 1-Click Check-in';
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

    // --- Morning Mindset & Journaling State Manager ---
    let dashSelectedMood = 5;

    globalThis.setDashboardMood = function (score) {
      dashSelectedMood = score;
      document.querySelectorAll(".dash-mood-btn").forEach((btn) => {
        if (parseInt(btn.getAttribute("data-score"), 10) === score) {
          btn.style.background = "rgba(99, 102, 241, 0.35)";
          btn.style.borderColor = "var(--primary)";
        } else {
          btn.style.background = "rgba(0, 0, 0, 0.3)";
          btn.style.borderColor = "var(--border-subtle)";
        }
      });
    };

    async function loadDashboardJournal() {
      if (!currentSubscriber?.email) return;
      try {
        const res = await fetch("/api/journal/today", {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
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
        showToast("Network error. Saved locally.", "warn");
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
      heatmapDrawer.classList.add("open");
      heatmapDrawer.setAttribute("aria-hidden", "false");
    }

    function closeHeatmapDrawer() {
      if (!heatmapDrawer) return;
      heatmapDrawer.classList.remove("open");
      heatmapDrawer.setAttribute("aria-hidden", "true");
    }

    if (btnDrawerClose) btnDrawerClose.addEventListener("click", closeHeatmapDrawer);
    if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeHeatmapDrawer);

    async function loadActivityHeatmap() {
      if (!heatmapCard) return;
      try {
        const res = await fetch("/api/journal/heatmap?days=365", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;

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

    function renderHeatmapGrid(days) {
      if (!heatmapGrid || !days.length) return;
      heatmapGrid.innerHTML = "";

      // Render Month Headers across 52 weeks
      if (heatmapMonths) {
        heatmapMonths.innerHTML = "<span></span>";
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
          heatmapMonths.appendChild(span);
        }
      }

      // Render Day Cells
      days.forEach((day) => {
        const cell = document.createElement("div");
        cell.className = `heatmap-cell level-${day.intensity || 0}`;
        cell.setAttribute("tabindex", "0");
        cell.setAttribute("role", "gridcell");
        cell.setAttribute(
          "aria-label",
          `${day.date}: ${day.completed ? `Active (Mood ${day.moodScore}/5)` : "No check-in"}`,
        );

        cell.addEventListener("mouseenter", (e) => {
          if (!heatmapTooltip) return;
          const moodText = day.completed ? ` • Mood: ${day.moodScore}/5` : " • Inactive";
          const snippetText = day.oneBigThingSnippet ? `<br/>🎯 ${day.oneBigThingSnippet}` : "";
          heatmapTooltip.innerHTML = `<strong>${day.date}</strong>${moodText}${snippetText}`;
          heatmapTooltip.style.display = "block";
          heatmapTooltip.style.opacity = "1";

          const rect = cell.getBoundingClientRect();
          heatmapTooltip.style.left = `${rect.left + rect.width / 2}px`;
          heatmapTooltip.style.top = `${rect.top - 8}px`;
        });

        cell.addEventListener("mouseleave", () => {
          if (!heatmapTooltip) return;
          heatmapTooltip.style.opacity = "0";
          heatmapTooltip.style.display = "none";
        });

        cell.addEventListener("click", () => openHeatmapDrawer(day));
        cell.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openHeatmapDrawer(day);
          }
        });

        heatmapGrid.appendChild(cell);
      });
    }

    // --- AI Coach Persona Manager ---
    const coachPersonaCard = document.getElementById("coachPersonaCard");
    const personaGrid = document.getElementById("personaGrid");
    const prefCoachPersona = document.getElementById("prefCoachPersona");
    const activePersonaBadge = document.getElementById("activePersonaBadge");
    const saveCoachPersonaBtn = document.getElementById("saveCoachPersonaBtn");
    const coachPersonaSaveStatus = document.getElementById("coachPersonaSaveStatus");

    const PERSONA_BADGE_MAP = {
      stoic: "🏛️ Stoic Sage",
      relentless: "⚡ Relentless Operator",
      zen: "🧘 Zen Master",
      "tech-lead": "💻 Principal Architect",
      optimist: "☀️ Momentum Catalyst",
    };

    function selectCoachPersona(personaKey) {
      if (!personaKey) return;
      const norm = personaKey.toLowerCase().trim();
      if (prefCoachPersona) prefCoachPersona.value = norm;
      if (activePersonaBadge) {
        activePersonaBadge.textContent = PERSONA_BADGE_MAP[norm] || "🏛️ Stoic Sage";
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
          const resp = await fetch("/me/coach-persona", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coachPersona: persona }),
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
    const shareCardPreviewImg = document.getElementById("shareCardPreviewImg");
    const shareTwitterBtn = document.getElementById("shareTwitterBtn");
    const shareLinkedinBtn = document.getElementById("shareLinkedinBtn");
    const copyShareLinkBtn = document.getElementById("copyShareLinkBtn");
    const copyMarkdownBadgeBtn = document.getElementById("copyMarkdownBadgeBtn");

    function openStreakShareModal() {
      if (!streakShareModal) return;
      const streak = currentSubscriber?.streakCount || 1;
      const email = currentSubscriber?.email || "subscriber";
      const track = currentSubscriber?.routineTrack || "deep-work";
      const officialDomain = window.location.origin;

      const svgCardUrl = `${officialDomain}/api/streak-card.svg?email=${encodeURIComponent(email)}&streak=${streak}&track=${encodeURIComponent(track)}`;

      if (shareCardPreviewImg) {
        shareCardPreviewImg.src = svgCardUrl;
      }

      const tweetText = encodeURIComponent(
        `🔥 Locked in a ${streak}-day unbroken morning routine streak on Morning Routine Sender! ⚡ Leveling up deep work & mental clarity every single morning. Check out your morning focus routine:`,
      );
      const routineUrl = encodeURIComponent(`${officialDomain}/routine`);

      if (shareTwitterBtn) {
        shareTwitterBtn.href = `https://twitter.com/intent/tweet?text=${tweetText}&url=${routineUrl}&hashtags=MorningRoutine,DeepWork,Habits,Discipline`;
      }

      if (shareLinkedinBtn) {
        shareLinkedinBtn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${routineUrl}`;
      }

      streakShareModal.style.display = "flex";
      streakShareModal.setAttribute("aria-hidden", "false");
    }

    function closeStreakShareModal() {
      if (!streakShareModal) return;
      streakShareModal.style.display = "none";
      streakShareModal.setAttribute("aria-hidden", "true");
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
        const streak = currentSubscriber?.streakCount || 1;
        const email = currentSubscriber?.email || "subscriber";
        const track = currentSubscriber?.routineTrack || "deep-work";
        const svgUrl = `${window.location.origin}/api/streak-card.svg?email=${encodeURIComponent(email)}&streak=${streak}&track=${encodeURIComponent(track)}`;

        navigator.clipboard
          .writeText(svgUrl)
          .then(() => {
            showToast("📋 SVG Streak Card link copied to clipboard!", "success");
          })
          .catch(() => {
            showToast("Failed to copy link.", "warn");
          });
      });
    }

    if (copyMarkdownBadgeBtn) {
      copyMarkdownBadgeBtn.addEventListener("click", function () {
        const streak = currentSubscriber?.streakCount || 1;
        const email = currentSubscriber?.email || "subscriber";
        const track = currentSubscriber?.routineTrack || "deep-work";
        const svgUrl = `${window.location.origin}/api/streak-card.svg?email=${encodeURIComponent(email)}&streak=${streak}&track=${encodeURIComponent(track)}`;
        const markdownBadge = `[![Morning Routine Streak](${svgUrl})](${window.location.origin}/routine)`;

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

    loadDashboard();
    syncNotificationState();
  })();
});
