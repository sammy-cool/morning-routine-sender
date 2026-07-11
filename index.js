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
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "data:",
        ],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        // Helmet defaults this to 'none' SEPARATELY from script-src -- it
        // does not inherit 'unsafe-inline' from script-src above. This is
        // specifically what governs onclick="..."/onchange="..." attributes
        // (admin-dashboard.html has 30+ of these). Missed this on the first
        // pass -- the local smoke test only hit the landing page, not the
        // admin dashboard where these actually live.
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
