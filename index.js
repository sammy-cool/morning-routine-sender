// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const {
  createTransporter,
  closeTransporter,
} = require("./config/email-config");
const emailTracker = require("./email-core/emailTracker");
const emailScheduler = require("./email-core/emailScheduler"); // Add this
const logger = require("./logger");

const app = express();
const fs = require("node:fs");
const path = require("node:path");
const rateLimit = require("express-rate-limit");

// const allowedOrigins = [
//   "https://morning-routine-sender.onrender.com/",
//   "https://priyanshu-eureka.netlify.app/",
//   "http://localhost:2900/",
//   "http://localhost:2900/send-test-email",
// ];

// const corsOptions = {
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
// };

// app.use(cors(corsOptions));
app.use(cors());

const PORT = process.env.PORT || 2900;

app.use(express.json());
app.use("/assets", express.static("assets"));
app.use(express.static("public"));

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

const sendEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Allow 5 requests per IP
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mode: "auto-scheduling-enabled",
  });
});

app.get("/manifest.json", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "manifest.json"));
});

app.get("/sw.js", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "sw.js"));
});

// TODO !OPTIONAL
// app.get("/js/settings-manager.js", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "js", "settings-manager.js"));
// });

// app.get("/js/analytics-handler.js", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "js", "analytics-handler.js"));
// });

// index.js - Enhanced admin dashboard endpoint
app.get("/", (req, res) => {
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const domain = protocol + "://" + req.get("host");
  logger.info("Dashboard accessed", { domain, ip: req.ip });

  // Read HTML file
  let html = fs.readFileSync(
    path.join(__dirname, "public", "dashboard.html"),
    "utf8"
  );

  // Replace placeholder with actual domain
  html = html.replace("__DOMAIN__", domain);

  res.send(html);
});

// Database read endpoint
app.get("/read-db", sendEmailLimiter, async (req, res) => {
  if (req.query.key !== process.env.CRON_API_KEY) {
    logger.error("Forbidden");
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const { readDb } = require("./helper/read-db");
    const result = await readDb();
    logger.info("Database reading successful");
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("Database reading failed", { error: error.message || error });
    res.status(500).json({ success: false, error: error.message || error });
  }
});

// Manual database cleanup endpoint (admin only)
app.post("/admin/cleanup-database", async (req, res) => {
  try {
    const DEFAULT_DAYS = 30;
    const envDays = Number(process.env.DB_RETENTION_DAYS);
    const bodyDays = Number(req?.body?.days);

    let days = DEFAULT_DAYS;

    if (Number.isFinite(bodyDays) && bodyDays > 0) {
      days = bodyDays;
    } else if (Number.isFinite(envDays) && envDays > 0) {
      days = envDays;
    }

    const { cleanupOldEmailRecords } = require("./helper/database-cleanup");
    const result = await cleanupOldEmailRecords(days);

    res.json(result);
  } catch (error) {
    logger.error("Manual cleanup failed", { error: error.message || error });
    res.status(500).json({ success: false, error: error.message || error });
  }
});

// Database stats endpoint
app.get("/admin/database-stats", async (req, res) => {
  try {
    const { getDatabaseStats } = require("./helper/database-cleanup");
    const stats = await getDatabaseStats();

    res.json(stats);
  } catch (error) {
    logger.error("Failed to get stats", { error: error.message || error });
    res.status(500).json({ success: false, error: error.message || error });
  }
});

// Logs cleanup endpoint
app.post("/admin/cleanup-logs", async (req, res) => {
  try {
    const fs = require("fs").promises;
    const path = require("path");
    const logsDir = path.join(__dirname, "logs");

    const files = await fs.readdir(logsDir);
    let deleted = 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 3);

    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stats = await fs.stat(filePath);

      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        deleted++;
        logger.info("Deleted old log file", { file });
      }
    }

    res.json({ success: true, deleted });
  } catch (error) {
    logger.error("Log cleanup failed", { error: error.message || error });
    res.status(500).json({ success: false, error: error.message || error });
  }
});

// Manual email trigger endpoint
app.post("/send-test-email", sendEmailLimiter, async (req, res) => {
  try {
    const { email, templateType } = req.body;
    if (
      email !== process.env.FROM_USER &&
      req.query.key !== process.env.CRON_API_KEY
    ) {
      logger.error("Forbidden");
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (email === process.env.FROM_USER) {
      logger.info("⚡ Skipping API key check for ADMIN EMAIL!");
    }

    const emailService = require("./email-core/emailService");

    const result = await emailService.sendRoutineEmail(
      getTransporter(),
      email,
      templateType || "default"
    );

    await emailTracker.recordSend(
      email,
      templateType || "default",
      result.messageId,
      { manual: true }
    );

    logger.info("✅ Test email sent successfully", {
      email,
      messageId: result.messageId,
      templateType: templateType || "default",
    });

    return res.status(200).json({
      success: true,
      messageId: result.messageId,
      email,
      templateType: templateType || "default",
    });
  } catch (error) {
    logger.error("❌ Failed to send test email", {
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error occurred",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// NEW: Get scheduled jobs status
app.get("/scheduled-jobs", (req, res) => {
  const jobs = emailScheduler.getScheduledJobsStatus();
  res.json({
    count: jobs.length,
    jobs,
  });
});

// NEW: Trigger bulk send manually (for testing)
app.post("/send-bulk-now", sendEmailLimiter, async (req, res) => {
  if (req.query.key !== process.env.CRON_API_KEY) {
    logger.error("Forbidden");
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const result = await emailScheduler.sendBulkEmails();
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("❌ Bulk send failed", { error: error.message || error });
    res.status(500).json({
      success: false,
      error: error.message || error || "Unknown error occurred",
    });
  }
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`✅ Server started on port ${PORT}`);
  logger.info(
    `🔄 Mode: ${
      process.env.NODE_ENV || "development"
    } Auto-scheduling enabled with node-cron`
  );

  // Initialize automatic scheduling
  setTimeout(() => {
    logger.info("⏰ Initializing automatic email scheduling...");
    emailScheduler.scheduleAllJobs();
  }, 5000); // 8 second delay to ensure everything is ready

  // Schedule cleanup jobs
  setTimeout(() => {
    emailScheduler.scheduleCleanupJobs();
    logger.info("🧹 Database cleanup scheduled (daily at 2 AM)");
  }, 10000);
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown...`);

  try {
    server.close();

    // Stop all cron jobs
    emailScheduler.stopAllJobs();

    if (transporter) {
      await closeTransporter(transporter);
      transporter = null;
    }

    await emailTracker.close();

    logger.info("✅ Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error during shutdown", { error: error.message });
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message || error });
  gracefulShutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason });
  gracefulShutdown("unhandledRejection");
});
