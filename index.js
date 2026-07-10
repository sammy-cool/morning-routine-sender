// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const app = express();

// Render sits in front of this app as a single reverse proxy hop. Setting
// this to 1 (rather than `true`, which trusts every hop) means Express
// only trusts X-Forwarded-* headers from that one hop -- the precise
// setting recommended by Express's own proxy docs for this topology.
// Fixes: req.ip previously returned Render's internal proxy IP for every
// visitor, which silently broke the allowedIPs check in
// auth.controller.js and made express-rate-limit apply its limit
// globally instead of per-client (it logs a ValidationError about this
// exact situation when trust proxy isn't set behind a detected proxy).
app.set("trust proxy", 1);

// Adds baseline security headers (X-Frame-Options, HSTS, noSniff, etc.).
// Was already a dependency in package.json but never actually applied.
// CSP is explicitly disabled here: Helmet's default Content-Security-Policy
// (default-src 'self') blocks inline scripts/styles and external CDN
// resources unless allowlisted, and public/ + admin-renderer/ haven't been
// audited for what they actually load. Enabling it blind risks silently
// breaking the dashboard pages. Turn it on deliberately once that audit
// happens -- see ARCHITECTURE.md.
app.use(helmet({ contentSecurityPolicy: false }));

const cookieParser = require("cookie-parser");
const compression = require("compression");

const emailTracker = require("./email-core/emailTracker");
const emailScheduler = require("./email-core/emailScheduler");
const logger = require("./logger");
const { setApiBase } = require("./middleware/setApiBase");
const { closeTransporterConnection } = require("./config/mailTransporter");
const { validateEnv } = require("./config/env");

validateEnv();


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
const pagesController = require("./controllers/pages.controller");

app.get("/admin-dashboard", pagesController.adminDashboard);

app.use("/assets", express.static("assets"));
app.use(express.static("public"));

const PORT = process.env.PORT || 2900;
app.use(require("./routes/auth.routes"));

app.use(require("./routes/pages.routes"));

app.use(require("./routes/admin.routes"));

app.use(require("./routes/email.routes"));

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

    await closeTransporterConnection();

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
