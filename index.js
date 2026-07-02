// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Redis = require("ioredis");
const cookieParser = require("cookie-parser");
const compression = require("compression");

const {
  createTransporter,
  closeTransporter,
} = require("./config/email-config");
const emailTracker = require("./email-core/emailTracker");
const emailScheduler = require("./email-core/emailScheduler");
const logger = require("./logger");
const { setApiBase } = require("./middleware/setApiBase");
const { unsubscribeUser } = require("./lib/myLib");
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

// app.enable("trust proxy");

app.disable("etag");
app.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});
app.use(cors());
app.use(express.json());
app.use(setApiBase);
app.use(cookieParser());
// ENABLE gzip / brotli
app.use(compression());

// Protected admin-dashboard.html
app.get("/admin-dashboard", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (req.cookies?.mrn_role !== "admin") {
    return res.redirect(302, "/");
  }

  const domain = app.locals.apiBase || `${req.protocol}://${req.get("host")}`;
  logger.info("Admin Dashboard accessed", { domain, ip: req.ip });
  let html = fs.readFileSync(
    path.join(__dirname, "admin-renderer/views", "admin-dashboard.html"),
    "utf8",
  );
  html = html.replaceAll("__DOMAIN__", domain);
  return res.send(html);
});

app.use("/assets", express.static("assets"));
app.use(express.static("public"));

const PORT = process.env.PORT || 2900;
let transporter = null;
const redis = new Redis(
  process.env.REDIS_LEAP_URL || "redis://127.0.0.1:6379",
  {
    tls: {}, // Required for Render Redis (enables SSL)
    // maxRetriesPerRequest: null, // prevents retry limit errors
    // enableReadyCheck: false,    // avoids ready check errors
  },
);

redis.on("connect", () => {
  logger.info("✅ Redis connected");
});

redis.on("error", (err) => {
  logger.error("❌ Redis connection error:", err.message);
});

// -------------- CONFIG --------------
const KEY_EXPIRY_SECONDS = 300; // 5 minutes

// 🔹 Generate one-time key (protected route)
app.get("/generate-admin-key", async (req, res) => {
  logger.info("🔑 Generating one-time key 🔹 (protected route)");

  res.set("Cache-Control", "no-store");
  const adminSecret = req.get("x-admin-secret") || req.query.adminSecret;

  if (adminSecret !== process.env.ADMIN_KEY) {
    logger.error("Forbidden: Invalid admin secret");
    return res.status(403).json({ message: "Forbidden: Invalid admin secret" });
  }

  const key = crypto.randomBytes(32).toString("hex");
  try {
    await redis.set(`admin_key:${key}`, "valid", "EX", KEY_EXPIRY_SECONDS);
  } catch (error) {
    logger.error("❌ Redis unavailable while generating admin key", {
      error: error.message,
    });
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable, try again shortly." });
  }

  logger.info(`🔑 New one-time key generated 🔹: GG!`);
  res.json({
    message: "✅ One-time key generated (valid for 5 minutes)",
    key,
    timestamp: new Date().toISOString(),
  });
});

function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

const sendEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.ALLOWED_RATE_LIMITER, // Allow 5 requests per IP
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

app.get("/offline", (req, res, next) => {
  const domain = app.locals.apiBase || `${req.protocol}://${req.get("host")}`;
  logger.info("Landed in sleeping night", { domain, ip: req.ip });
  let html = fs.readFileSync(
    path.join(__dirname, "public", "offline.html"),
    "utf8",
  );
  html = html.replaceAll("__DOMAIN__", domain);
  return res.send(html);
});

const allowedIPs = new Set(["127.0.0.1", "::1", "YOUR_SERVER_IP"]);

app.post("/secret-jobs-scheduler", async (req, res) => {
  const clientIP = req.ip || req.socket.remoteAddress;
  const { key, action } = req.query;

  //IP Restriction
  if (process.env.NODE_ENV === "development") {
    if (!allowedIPs.has(clientIP)) {
      logger.error("❌ Forbidden: Unauthorized IP");
      return res.status(403).json({ message: "❌ Forbidden: Unauthorized IP" });
    }
  }

  if (!key) return res.status(400).json({ message: "Missing ?key parameter" });

  let keyExists;
  try {
    keyExists = await redis.get(`admin_key:${key}`);
  } catch (error) {
    logger.error("❌ Redis unavailable while verifying key", {
      error: error.message,
    });
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable, try again shortly." });
  }

  if (!keyExists) {
    return res.status(403).json({ message: "❌ Invalid or expired key" });
  }

  try {
    // Valid key → delete immediately (one-time use)
    await redis.del(`admin_key:${key}`);

    if (action === "start") {
      emailScheduler.scheduleAllJobs();
      return res.json({ message: "✅ All cron jobs scheduled and running." });
    } else if (action === "stop") {
      emailScheduler.stopAllJobs();
      return res.json({ message: "🛑 All cron jobs stopped." });
    } else {
      return res
        .status(400)
        .json({ message: "Invalid or missing ?action=start|stop parameter." });
    }
  } catch (error) {
    logger.error("Error managing cron jobs:", error);
    return res
      .status(500)
      .json({ message: "Internal server error.", error: error.message });
  }
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

// Serve user dashboard separately
app.get("/user-dashboard", (req, res) => {
  const domain = app.locals.apiBase || `${req.protocol}://${req.get("host")}`;

  logger.info("User Dashboard accessed", { domain, ip: req.ip });
  let html = fs.readFileSync(
    path.join(__dirname, "public", "user-dashboard.html"),
    "utf8",
  );
  html = html.replace("__DOMAIN__", domain);
  res.send(html);
});

// index.js - Enhanced admin dashboard endpoint
// Root route - Enterprise skeleton + key modal
// =================== ROOT ROUTE (SKELETON + MODAL) ===================
app.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  const domain = app.locals.apiBase || `${req.protocol}://${req.get("host")}`;

  try {
    if (req.cookies?.mrn_role === "admin") {
      logger.info("Admin Dashboard accessed", { domain, ip: req.ip });
      return res.redirect("/admin-dashboard");
    } else if (req.cookies?.mrn_role === "user") {
      logger.info("User Dashboard accessed", { domain, ip: req.ip });
      return res.redirect("/user-dashboard");
    } else {
      // fallback to index (main view page)
      logger.info("Landing page accessed", { domain, ip: req.ip });

      let html = fs.readFileSync(
        path.join(__dirname, "public", "main-index.html"),
        "utf8",
      );
      html = html.replaceAll("__DOMAIN__", domain);
      return res.send(html);
    }
  } catch (err) {
    logger.error(
      "Failed to serve dashboard: redirecting back to main view page",
      err,
    );
    let html = fs.readFileSync(
      path.join(__dirname, "public", "main-index.html"),
      "utf8",
    );
    html = html.replaceAll("__DOMAIN__", domain);
    return res.send(html);
  }
});

// ---------- Verify admin key (client POSTs key here) ----------
app.post("/verify-admin-key", express.json(), async (req, res) => {
  try {
    const key = req.body?.key ? String(req.body.key).trim() : null;
    if (!key) return res.status(400).json({ error: "Missing key" });

    const keyExists = await redis.get(`admin_key:${key}`);
    if (!keyExists) {
      // not an admin key — return 200 but role user (keeping UX simple)
      return res.status(200).json({ role: "user" });
    }

    // valid one-time key -> delete it (one-time use)
    await redis.del(`admin_key:${key}`);

    // Optional: set short-lived secure cookie so admin view is accessible for a few minutes
    // NOTE: set 'secure: true' in production (HTTPS)
    const isProd = process.env.NODE_ENV === "production";

    res.cookie("mrn_role", "admin", {
      httpOnly: true,
      secure: isProd, // true on production
      sameSite: isProd ? "none" : "lax",
      path: "/", // required
      maxAge: 5 * 60 * 1000,
    });

    return res.json({ role: "admin" });
  } catch (err) {
    logger.error("verify-admin-key error", { error: err.message || err });
    return res.status(500).json({ error: "Server error verifying key" });
  }
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
    logger.info("Getting Database Result");
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

    let days;

    if (Number.isFinite(bodyDays) && bodyDays > 0) {
      days = bodyDays;
    } else if (Number.isFinite(envDays) && envDays > 0) {
      days = envDays;
    } else {
      logger.warn(
        "No days specified in Body | Env | Specified days is not Greater than Zero!, using default value",
      );
      days = DEFAULT_DAYS;
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
    const { email } = req.body;
    let templateType = req.body.templateType || "basic";

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
      req.app.locals,
      {
        email,
        templateType,
      },
    );

    await emailTracker.recordSend(email, templateType, result.messageId, {
      manual: true,
    });

    logger.info("✅ Email sent successfully manually.", {
      email,
      messageId: result.messageId,
      templateType,
    });

    return res.status(200).json({
      success: true,
      messageId: result.messageId,
      email,
      templateType,
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

app.get("/unsubscribe", (req, res) => {
  logger.info("Unsubscribing user", {
    email: req.query.email || "Hurray 🎉 User Unsubscribed",
  });
  res.json(
    unsubscribeUser(req.query.email || "unknown@example.com", req.app.locals),
  );
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
    const adminSkip = req.query.adminSkip;
    const appLocals = req.app.locals;
    const result = await emailScheduler.sendBulkEmails(adminSkip, appLocals);
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
  logger.info(
    `✅ Server started on port ${PORT} > 🔄 Mode: ${
      process.env.NODE_ENV || "development"
    } Auto-scheduling enabled with node-cron`,
  );

  // Initialize automatic scheduling
  setTimeout(() => {
    logger.info("⏰ Initializing automatic email scheduling...");
    emailScheduler.scheduleAllJobs();
  }, 5000); // delay for few seconds to ensure everything is ready

  // Schedule cleanup jobs
  setTimeout(() => {
    emailScheduler.scheduleCleanupJobs();
    logger.info("🧹 Database cleanup scheduled for every (Sunday at 2 AM)");
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
