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
const { createTransporter } = require("../config/email-config");
const emailService = require("./emailService");
const emailTracker = require("./emailTracker");
const {
  cleanupOldEmailRecords,
  optimizeDatabase,
} = require("../helper/database-cleanup");
const { maskEmail } = require("../helper/util");

let transporter = null;
let scheduledJobs = [];

/**
 * Get or create transporter instance
 */
function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

/**
 * Send routine email to a single user
 */
async function sendRoutineEmail(
  userData,
  adminSkip = "GG!",
  appLocals = process.env.RENDER_URL
) {
  try {
    // Check if already sent today
    const alreadySent = await emailTracker.wasEmailSentToday(
      userData.email,
      userData.templateType
    );

    const isAdminSkip = adminSkip === process.env.ADMIN_SKIP_KEY;
    if (alreadySent) {
      const logMessage = isAdminSkip
        ? "Admin override active — proceeding despite prior send."
        : "Email already sent today, skipping.";

      const logLevel = isAdminSkip ? "warn" : "info";

      logger[logLevel](logMessage, {
        email: userData.email,
        templateType: userData.templateType,
        adminOverride: isAdminSkip,
      });

      if (!isAdminSkip) {
        return { status: "skipped", reason: "already_sent_today" };
      }
    }

    // Send email
    const result = await emailService.sendRoutineEmail(
      getTransporter(),
      appLocals,
      userData
    );

    // Record in database
    await emailTracker.recordSend(
      userData.email,
      userData.templateType,
      result.messageId,
      { scheduled: true }
    );

    logger.info("✅ Scheduled email sent successfully", {
      email: userData.email,
      messageId: result.messageId,
      templateType: userData.templateType,
    });

    return { status: "success", messageId: result.messageId };
  } catch (error) {
    logger.error("❌ Failed to send scheduled email", {
      email: userData.email,
      error: error.message,
    });

    // Record failure
    await emailTracker.recordFailure(
      userData.email,
      userData.templateType,
      error.message,
      0
    );

    return { status: "failed", error: error.message };
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
 * Schedule recurring jobs for all users
 */
async function scheduleAllJobs() {
  // Stop any existing jobs
  stopAllJobs();

  const users = await sharedData.getUsers();

  logger.info("📅 Scheduling cron jobs for all users", {
    userCount: users.length,
  });

  for (const user of users) {
    const cronPattern = user.cronPattern || "0 8 * * *"; // Default: 8 AM daily

    try {
      // Validate cron pattern
      if (!cron.validate(cronPattern)) {
        logger.error("Invalid cron pattern", {
          email: user.email,
          cronPattern,
        });
        continue;
      }

      // Schedule job
      const job = cron.schedule(
        cronPattern,
        async () => {
          logger.info("⏰ Cron job triggered", {
            email: user.email,
            templateType: user.templateType || "basic",
            time: new Date().toISOString(),
          });

          const currentUser = await sharedData.getUserByEmail(user.email);
          if (!currentUser || !currentUser.is_active) {
            logger.info('Skipping inactive user', { email: user.email });
            return;
          }

          await sendRoutineEmail(currentUser);
        },
        {
          scheduled: true,
          timezone: user.timezone || "Asia/Kolkata",
        }
      );
      scheduledJobs.push({
        email: user.email,
        job,
        cronPattern,
      });
    } catch (error) {
      logger.error("Failed to schedule recurring job", {
        error: error.message,
        email: user.email,
        cronPattern,
      });
    }
  }
}

/**
 * Stop all scheduled jobs
 */
function stopAllJobs() {
  logger.info("🛑 Stopping all cron jobs...");

  for (const { email, job } of scheduledJobs) {
    job.stop();
    logger.info("Stopped cron job", { email });
  }

  scheduledJobs = [];
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
        `🧹 Running scheduled database cleanup of last ${process.env.DB_RETENTION_DAYS} days!...`
      );

      // Delete records older than 30 days
      await cleanupOldEmailRecords(process.env.DB_RETENTION_DAYS || 30);

      // Optimize database
      await optimizeDatabase();
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    }
  );

  // logger.info("✅ Cleanup job scheduled (every sunday at 2 AM)");

  scheduledJobs.push({
    email: 'system_cleanup',
    job: cleanupJob,
    cronPattern: '0 2 * * 0'
  });

  return cleanupJob;
}

module.exports = {
  scheduleAllJobs,
  stopAllJobs,
  sendRoutineEmail,
  sendBulkEmails,
  getScheduledJobsStatus,
  scheduleCleanupJobs,
};
