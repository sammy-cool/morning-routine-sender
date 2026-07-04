// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const fs = require("node:fs");
const path = require("node:path");
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
app.use(require("./routes/auth.routes"));

function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

const { sendEmailLimiter } = require("./middleware/rateLimiters");

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
// Database read endpoint
app.use(require("./routes/admin.routes"));

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
