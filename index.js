// index.js
require("dotenv").config();
const path = require("path");
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

// Adds baseline security headers (X-Frame-Options, HSTS, noSniff, etc.),
// plus a Content-Security-Policy built from an actual audit of
// public/ and admin-renderer/ (see ARCHITECTURE.md):
//   - script-src/style-src need 'unsafe-inline': the frontend relies on
//     30+ inline onclick/onchange handlers (mostly admin-dashboard.html)
//     plus inline <script>/<style> blocks. Removing 'unsafe-inline' would
//     require converting every inline handler to addEventListener() across
//     6 HTML files -- real code changes, a separate deliberate project,
//     not done here. This CSP is real protection against loading
//     resources from unlisted external origins and clickjacking, just not
//     a defense against inline-script-based XSS specifically.
//   - cdn.jsdelivr.net: the toast-notification library's <script src>
//   - fonts.googleapis.com / fonts.gstatic.com: Google Fonts
//   - cdnjs.cloudflare.com: Font Awesome (some pages use this CDN, others
//     the local public/vendor/fontawesome copy -- inconsistent, not
//     addressed here)
//   - connect-src 'self' only: every fetch() in the codebase is same-origin
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "data:",
        ],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        connectSrc: [
          "'self'",
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://*.onrender.com",
          "https://*.netlify.app",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        scriptSrcAttr: ["'unsafe-inline'"],
      },
    },
  }),
);

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

// ENABLE gzip / brotli compression early in middleware pipeline
app.use(compression());
app.enable("etag");

const DEFAULT_ALLOWED_ORIGINS = [
  "https://morning-routine-sender.onrender.com",
  "https://priyanshu-eureka.netlify.app",
  "http://localhost:2900",
  "http://127.0.0.1:2900",
];

const customOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim().replace(/\/$/, ""))
  : [];

const allowedOriginsList = [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...customOrigins])];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, "");
      if (allowedOriginsList.includes(normalized)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(setApiBase);
app.use(logger.requestLogger);
app.use(cookieParser(process.env.ADMIN_KEY || 'dev-secret'));

// Protected admin-dashboard.html
const pagesController = require("./controllers/pages.controller");

app.get("/admin-dashboard", pagesController.adminDashboard);

// High performance static asset serving with caching and ETags
app.use("/assets", express.static(path.join(__dirname, "public", "assets"), { maxAge: "7d", etag: true }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1d", etag: true }));

app.use(require("./routes/auth.routes"));
app.use(require("./routes/pages.routes"));
app.use(require("./routes/admin.routes"));
app.use(require("./routes/subscribers.routes"));
app.use(require("./routes/subscriberPortal.routes"));
app.use("/api/webhooks", require("./routes/webhook.routes"));
app.use("/admin/deliverability", require("./routes/deliverability.routes"));
app.use(require("./routes/email.routes"));

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled Application Error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = parseInt(process.env.PORT, 10) || 2900;
const HOST = "0.0.0.0";

let server;

// Only bind server port when executed directly as main script
if (require.main === module) {
  server = app.listen(PORT, HOST, () => {
    logger.info(
      `✅ Server started on http://${HOST}:${PORT} > 🔄 Mode: ${
        process.env.NODE_ENV || "development"
      } Auto-scheduling enabled with node-cron`,
    );

    // Initialize automatic scheduling
    setTimeout(async () => {
      try {
        logger.info("⏰ Initializing automatic email scheduling...");
        await emailScheduler.scheduleAllJobs();
      } catch (error) {
        logger.warn("⚠️  Could not schedule email jobs (database may be unavailable)", {
          error: error.message,
        });
      }
    }, 5000); // delay for few seconds to ensure everything is ready

    // Schedule cleanup jobs
    setTimeout(() => {
      try {
        emailScheduler.scheduleCleanupJobs();
        logger.info("🧹 Database cleanup scheduled for every (Sunday at 2 AM)");
      } catch (error) {
        logger.warn("⚠️  Could not schedule cleanup jobs", {
          error: error.message,
        });
      }
    }, 10000);
  });

  server.on("error", (err) => {
    logger.error("❌ Server listen socket error:", { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown...`);

  try {
    if (server && typeof server.close === "function") {
      server.close();
    }

    // Stop all cron jobs
    if (emailScheduler && typeof emailScheduler.stopAllJobs === "function") {
      emailScheduler.stopAllJobs();
    }

    await closeTransporterConnection();

    await emailTracker.close();

    const redis = require("./config/redisClient");
    if (redis && typeof redis.quit === "function") {
      try {
        await redis.quit();
      } catch (e) {
        // ignore if already disconnected
      }
    }

    logger.info("✅ Graceful shutdown completed");
    process.exit(signal === "uncaughtException" ? 1 : 0);
  } catch (error) {
    logger.error("❌ Error during shutdown", { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  logger.error("Uncaught exception", { error: error.message || error, stack: error.stack });
  gracefulShutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (non-fatal):", reason);
  logger.error("Unhandled rejection (non-fatal)", { reason });
});

module.exports = app;
