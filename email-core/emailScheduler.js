// email-core/emailScheduler.js
const sharedData = require("../helper/shared-data");
const logger = require("../logger");

// /**
//  * Schedule all morning routine jobs
//  * Sets up recurring jobs for each user based on their preferences
//  */
// async function scheduleAllRoutineJobs() {
//   try {
//     logger.info("Scheduling all morning routine jobs...");

//     // Get users from shared data
//     const users = sharedData.getUsers(); // Assuming this returns array of users

//     // Schedule recurring job for each user
//     const schedulePromises = users.map((user) =>
//       scheduleRepeatingJob(
//         user.email,
//         user.templateType || "default",
//         user.cronPattern || "0 8 * * *" // Default: 8 AM daily
//       )
//     );

//     await Promise.all(schedulePromises);

//     logger.info("All routine jobs scheduled", {
//       userCount: users.length,
//     });

//     return { success: true, count: users.length };
//   } catch (error) {
//     logger.error("Failed to schedule routine jobs", {
//       error: error.message,
//     });
//     throw error;
//   }
// }

// /**
//  * Schedule immediate bulk send (e.g., for testing or one-time campaigns)
//  */
// async function scheduleImmediateBulkSend() {
//   try {
//     const users = sharedData.getUsers();

//     const recipients = users.map((user) => ({
//       email: user.email,
//       templateType: user.templateType || "default",
//     }));

//     await scheduleBulkEmails(recipients);

//     logger.info("Immediate bulk send scheduled", {
//       count: recipients.length,
//     });

//     return { success: true, count: recipients.length };
//   } catch (error) {
//     logger.error("Failed to schedule bulk send", {
//       error: error.message,
//     });
//     throw error;
//   }
// }

// module.exports = {
//   scheduleAllRoutineJobs,
//   scheduleImmediateBulkSend,
// };

// email-core/emailScheduler.js
const cron = require("node-cron");
const { getTransporter } = require("../config/mailTransporter");
const emailService = require("./emailService");
const emailTracker = require("./emailTracker");
const { cleanupOldEmailRecords, optimizeDatabase } = require("../helper/database-cleanup");
const { maskEmail } = require("../helper/util");
const suppressionService = require("./suppressionService");
const { retryWithBackoff } = require("../helper/retryUtil");
const { isRetryableError } = require("../helper/errorClassifier");

let scheduledJobs = [];

/**
 * Send routine email to a single user with automatic retry backoff
 */
async function sendRoutineEmail(userData, adminSkip = "GG!", appLocals = process.env.RENDER_URL) {
  let finalAttempts = 0;
  let finalRetries = 0;

  try {
    const isAdminSkip = adminSkip === process.env.ADMIN_SKIP_KEY;

    // Check pre-send suppression eligibility
    const eligibility = await suppressionService.checkPreSendEligibility(userData.email);
    if (eligibility.isSuppressed && !isAdminSkip) {
      logger.warn("Recipient suppressed or on bounce cooldown, skipping dispatch.", {
        email: maskEmail(userData.email),
        reason: eligibility.reason,
      });
      return { status: "skipped", reason: eligibility.reason };
    }

    // Check if already sent today
    const alreadySent = await emailTracker.wasEmailSentToday(
      userData.email,
      userData.templateType,
      userData.timezone,
    );

    if (alreadySent) {
      const logMessage = isAdminSkip
        ? "Admin override active — proceeding despite prior send."
        : "Email already sent today, skipping.";

      const logLevel = isAdminSkip ? "warn" : "info";

      logger[logLevel](logMessage, {
        email: maskEmail(userData.email),
        templateType: userData.templateType,
        adminOverride: isAdminSkip,
      });

      if (!isAdminSkip) {
        return { status: "skipped", reason: "already_sent_today" };
      }
    }

    // Send email with automatic retry backoff on transient errors
    const { result, retries, totalAttempts } = await retryWithBackoff(
      async (attempt) => {
        finalAttempts = attempt + 1;
        finalRetries = attempt;
        return await emailService.sendRoutineEmail(getTransporter(), appLocals, userData);
      },
      {
        maxRetries: 3,
        baseDelayMs: 1500,
        onRetry: async ({ error, attempt, maxRetries, nextDelayMs }) => {
          logger.warn(
            `⚠️ SMTP dispatch attempt ${attempt}/${maxRetries + 1} failed for ${maskEmail(userData.email)}. Retrying in ${nextDelayMs}ms...`,
            {
              error: error.message,
              code: error.code,
            },
          );
        },
      },
    );

    // Dispatch Web Push Notification (non-blocking)
    try {
      const pushService = require("../push-core/pushService");
      await pushService.dispatchMorningPushForSubscriber(userData);
    } catch (pushErr) {
      logger.debug("Push notification dispatch non-fatal check", { error: pushErr.message });
    }

    // Dispatch Multi-Channel Notifications (Discord / Telegram) (non-blocking)
    try {
      const channelDispatcher = require("../helper/channelDispatcher");
      await channelDispatcher.dispatchChannelsForSubscriber(userData, {
        baseUrl: appLocals || process.env.RENDER_URL,
      });
    } catch (channelErr) {
      logger.debug("Multi-channel dispatch non-fatal check", { error: channelErr.message });
    }

    // Record in database
    await emailTracker.recordSend(
      userData.email,
      userData.templateType,
      result.messageId,
      {
        scheduled: true,
        attempts: totalAttempts,
        recovered: retries > 0,
        routineTrack: userData.routineTrack || userData.templateType,
      },
      retries,
    );

    logger.info("✅ Scheduled email sent successfully", {
      email: maskEmail(userData.email),
      messageId: result.messageId,
      templateType: userData.templateType,
      retries,
    });

    return { status: "success", messageId: result.messageId, retries };
  } catch (error) {
    const totalRetries = error.retriesExecuted !== undefined ? error.retriesExecuted : finalRetries;
    const totalAttempts = error.totalAttempts !== undefined ? error.totalAttempts : finalAttempts;

    logger.error("❌ Failed to send scheduled email", {
      email: maskEmail(userData.email),
      error: error.message,
      totalAttempts,
    });

    // Record failure with rich diagnostics
    await emailTracker.recordFailure(userData.email, userData.templateType, error, totalRetries, {
      scheduled: true,
      phase: "smtp_dispatch",
      isRetryable: error.isRetryable !== undefined ? error.isRetryable : isRetryableError(error),
      totalAttempts,
      routineTrack: userData.routineTrack || userData.templateType,
    });

    return { status: "failed", error: error.message, retries: totalRetries };
  }
}

/**
 * Send emails to all active users
 */
async function sendBulkEmails(adminSkip, appLocals) {
  logger.info("🚀 Starting bulk email send...");

  const users = await sharedData.getUsers();
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    const result = await sendRoutineEmail(user, adminSkip, appLocals);

    if (result.status === "success") {
      successCount++;
    } else if (result.status === "failed") {
      failureCount++;
    } else if (result.status === "skipped") {
      skippedCount++;
    }
  }

  logger.info("✅ Bulk email send completed", {
    total: users.length,
    success: successCount,
    failed: failureCount,
    skipped: skippedCount,
  });

  return { successCount, failureCount, skippedCount };
}

/**
 * Send Sunday Weekly Digest email to a single user with automatic retry backoff
 */
async function sendUserWeeklyDigest(
  userData,
  adminSkip = "GG!",
  appLocals = process.env.RENDER_URL,
) {
  let finalAttempts = 0;
  let finalRetries = 0;

  try {
    const alreadySent = await emailTracker.wasEmailSentToday(
      userData.email,
      "weekly-digest",
      userData.timezone,
    );

    const isAdminSkip = adminSkip === process.env.ADMIN_SKIP_KEY;
    if (alreadySent && !isAdminSkip) {
      logger.info("Weekly digest already sent today, skipping.", {
        email: maskEmail(userData.email),
      });
      return { status: "skipped", reason: "already_sent_today" };
    }

    const { result, retries, totalAttempts } = await retryWithBackoff(
      async (attempt) => {
        finalAttempts = attempt + 1;
        finalRetries = attempt;
        return await emailService.sendWeeklyDigestEmail(getTransporter(), appLocals, userData);
      },
      {
        maxRetries: 3,
        baseDelayMs: 1500,
        onRetry: async ({ error, attempt, maxRetries, nextDelayMs }) => {
          logger.warn(
            `⚠️ Weekly digest SMTP attempt ${attempt}/${maxRetries + 1} failed for ${maskEmail(userData.email)}. Retrying in ${nextDelayMs}ms...`,
            { error: error.message, code: error.code },
          );
        },
      },
    );

    await emailTracker.recordSend(
      userData.email,
      "weekly-digest",
      result.messageId,
      {
        scheduled: true,
        type: "weekly_digest",
        attempts: totalAttempts,
        recovered: retries > 0,
      },
      retries,
    );

    logger.info("✅ Sunday Weekly Digest sent successfully", {
      email: maskEmail(userData.email),
      messageId: result.messageId,
      retries,
    });

    return { status: "success", messageId: result.messageId, retries };
  } catch (error) {
    const totalRetries = error.retriesExecuted !== undefined ? error.retriesExecuted : finalRetries;
    const totalAttempts = error.totalAttempts !== undefined ? error.totalAttempts : finalAttempts;

    logger.error("❌ Failed to send Sunday weekly digest", {
      email: maskEmail(userData.email),
      error: error.message,
      totalAttempts,
    });

    await emailTracker.recordFailure(userData.email, "weekly-digest", error, totalRetries, {
      scheduled: true,
      type: "weekly_digest",
      phase: "weekly_digest_smtp",
      isRetryable: error.isRetryable !== undefined ? error.isRetryable : isRetryableError(error),
      totalAttempts,
    });

    return { status: "failed", error: error.message, retries: totalRetries };
  }
}

/**
 * Schedule recurring jobs for all users (Daily Routines + Sunday Weekly Digests)
 */
async function scheduleAllJobs() {
  // Stop any existing jobs
  stopAllJobs();

  const users = await sharedData.getUsers();

  logger.info("📅 Scheduling daily routines and Sunday weekly digests for all users", {
    userCount: users.length,
  });

  for (const user of users) {
    const cronPattern = user.cronPattern || "0 8 * * *"; // Default: 8 AM daily
    const userTz = user.timezone || "Asia/Kolkata";
    const sundayCron = "0 8 * * 0"; // Every Sunday at 8 AM local time

    // 1. Schedule Daily Routine Job
    try {
      if (cron.validate(cronPattern)) {
        const job = cron.schedule(
          cronPattern,
          async () => {
            logger.info("⏰ Daily cron job triggered", {
              email: user.email,
              templateType: user.templateType || "basic",
              time: new Date().toISOString(),
            });

            const currentUser = await sharedData.getUserByEmail(user.email);
            if (!currentUser || !currentUser.isActive) {
              logger.info("Skipping inactive user", { email: user.email });
              return;
            }

            await sendRoutineEmail(currentUser);
          },
          {
            scheduled: true,
            timezone: userTz,
          },
        );
        scheduledJobs.push({
          email: user.email,
          job,
          cronPattern,
          type: "daily_routine",
        });
      }
    } catch (error) {
      logger.error("Failed to schedule recurring daily job", {
        error: error.message,
        email: user.email,
        cronPattern,
      });
    }

    // 2. Schedule Sunday Weekly Digest Job
    try {
      const weeklyJob = cron.schedule(
        sundayCron,
        async () => {
          logger.info("⏰ Sunday Weekly Digest cron triggered", {
            email: user.email,
            timezone: userTz,
            time: new Date().toISOString(),
          });

          const currentUser = await sharedData.getUserByEmail(user.email);
          if (!currentUser || !currentUser.isActive) {
            return;
          }

          await sendUserWeeklyDigest(currentUser);
        },
        {
          scheduled: true,
          timezone: userTz,
        },
      );
      scheduledJobs.push({
        email: user.email,
        job: weeklyJob,
        cronPattern: sundayCron,
        type: "weekly_digest",
      });
    } catch (error) {
      logger.error("Failed to schedule Sunday weekly digest job", {
        error: error.message,
        email: user.email,
      });
    }
  }
}

/**
 * Stop all scheduled jobs
 */
function stopAllJobs() {
  logger.info("🛑 Stopping all cron jobs...");

  const remainingJobs = [];
  for (const jobData of scheduledJobs) {
    if (jobData.email === "system_cleanup") {
      remainingJobs.push(jobData);
    } else {
      jobData.job.stop();
      logger.info("Stopped cron job", { email: jobData.email });
    }
  }

  scheduledJobs = remainingJobs;
}

/**
 * Get status of all scheduled jobs
 */
function getScheduledJobsStatus() {
  return scheduledJobs.map(({ email, cronPattern }) => ({
    email: maskEmail(email),
    cronPattern,
    status: "active",
  }));
}

/**
 * Schedule daily cleanup job (runs at 2 AM)
 */
function scheduleCleanupJobs() {
  // Database cleanup - every day at 2 AM
  const cleanupJob = cron.schedule(
    "0 2 * * 0",
    async () => {
      logger.info(
        `🧹 Running scheduled database cleanup of last ${process.env.DB_RETENTION_DAYS} days!...`,
      );

      // Delete records older than 30 days
      await cleanupOldEmailRecords(process.env.DB_RETENTION_DAYS || 30);

      // Optimize database
      await optimizeDatabase();
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    },
  );

  // logger.info("✅ Cleanup job scheduled (every sunday at 2 AM)");

  scheduledJobs.push({
    email: "system_cleanup",
    job: cleanupJob,
    cronPattern: "0 2 * * 0",
  });

  return cleanupJob;
}

module.exports = {
  scheduleAllJobs,
  stopAllJobs,
  sendRoutineEmail,
  sendUserWeeklyDigest,
  sendBulkEmails,
  getScheduledJobsStatus,
  scheduleCleanupJobs,
};
