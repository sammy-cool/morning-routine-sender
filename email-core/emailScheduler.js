// email-core/emailScheduler.js
// const { scheduleRepeatingJob, scheduleBulkEmails } = require("./emailQueue");
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
async function sendRoutineEmail(user) {
  try {
    // Check if already sent today
    const alreadySent = await emailTracker.wasEmailSentToday(
      user.email,
      user.templateType || "default"
    );

    if (alreadySent) {
      logger.info("Email already sent today, skipping", {
        email: user.email,
        templateType: user.templateType,
      });
      return { status: "skipped", reason: "already_sent_today" };
    }

    // Send email
    const result = await emailService.sendRoutineEmail(
      getTransporter(),
      user.email,
      user.templateType || "default"
    );

    // Record in database
    await emailTracker.recordSend(
      user.email,
      user.templateType || "default",
      result.messageId,
      { scheduled: true }
    );

    logger.info("✅ Scheduled email sent successfully", {
      email: user.email,
      messageId: result.messageId,
      templateType: user.templateType,
    });

    return { status: "success", messageId: result.messageId };
  } catch (error) {
    logger.error("❌ Failed to send scheduled email", {
      email: user.email,
      error: error.message,
    });

    // Record failure
    await emailTracker.recordFailure(
      user.email,
      user.templateType || "default",
      error.message,
      0
    );

    return { status: "failed", error: error.message };
  }
}

/**
 * Send emails to all active users
 */
async function sendBulkEmails() {
  logger.info("🚀 Starting bulk email send...");

  const users = sharedData.getUsers();
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    const result = await sendRoutineEmail(user);

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
function scheduleAllJobs() {
  // Stop any existing jobs
  stopAllJobs();

  const users = sharedData.getUsers();

  logger.info("📅 Scheduling cron jobs for all users", {
    userCount: users.length,
  });

  users.forEach((user) => {
    const cronPattern = user.cronPattern || "0 8 * * *"; // Default: 8 AM daily

    try {
      // Validate cron pattern
      if (!cron.validate(cronPattern)) {
        logger.error("Invalid cron pattern", {
          email: user.email,
          cronPattern,
        });
        return;
      }

      // Schedule job
      const job = cron.schedule(
        cronPattern,
        async () => {
          logger.info("⏰ Cron job triggered", {
            email: user.email,
            templateType: user.templateType,
            time: new Date().toISOString(),
          });

          await sendRoutineEmail(user);
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

      logger.info("✅ Cron job scheduled", {
        email: user.email,
        cronPattern,
        timezone: user.timezone || "Asia/Kolkata",
      });
    } catch (error) {
      logger.error("Failed to schedule cron job", {
        email: user.email,
        error: error.message,
      });
    }
  });

  logger.info("📅 All cron jobs scheduled", {
    jobCount: scheduledJobs.length,
  });
}

/**
 * Stop all scheduled jobs
 */
function stopAllJobs() {
  logger.info("🛑 Stopping all cron jobs...");

  scheduledJobs.forEach(({ email, job }) => {
    job.stop();
    logger.info("Stopped cron job", { email });
  });

  scheduledJobs = [];
}

/**
 * Get status of all scheduled jobs
 */
function getScheduledJobsStatus() {
  return scheduledJobs.map(({ email, cronPattern }) => ({
    email,
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
    "0 2 * * *",
    async () => {
      logger.info("🧹 Running scheduled database cleanup...");

      // Delete records older than 30 days
      await cleanupOldEmailRecords(30);

      // Optimize database
      await optimizeDatabase();
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    }
  );

  logger.info("✅ Cleanup job scheduled (daily at 2 AM)");

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
