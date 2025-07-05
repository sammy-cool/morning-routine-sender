require("dotenv").config();
const express = require("express");
const compression = require("compression");
const cron = require("node-cron");
const rateLimit = require("express-rate-limit");
const validator = require("validator");

const logger = require("./logger");
const { runEmailJob } = require("./email-core/emailJobs");
const { cleanupOldEntries } = require("./email-core/emailTracker");

// Express app
const app = express();

// !INFO: - Render (your hosting platform) uses a reverse proxy to forward requests to your Node.js app. But since Express doesn’t trust proxies by default, it ignores this header.
// Tell Express to trust the reverse proxy (Render/Vercel/Heroku/etc)
app.set("trust proxy", 1); // 1 = only trust the first proxy

app.use(compression());
const port = process.env.PORT || 3000;

// Rate limiter for /send-email
const sendEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Allow 5 requests per IP
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

//API Endpoints
// Default Message for root URL
app.get("/", (req, res) => {
  const domain = req.protocol + "://" + req.get("host");
  logger.info("Domain:", domain);

  res.send(`
    <html>
      <head>
        <title>Send Email</title>
      </head>
      <body>
        <h1>Hit The Send Email Endpoint to receive the email!</h1>
        <a href="${domain}/send-email" target="_blank">Send Email</a>
        <br/>
        <a href="https://priyanshu-eureka.netlify.app/" target="_blank">Visit My Website</a>
        <br/>
        <a href="${domain}/health-check" target="_blank">Health Check</a>
      </body>
    </html>
  `);
});

// Health-check endpoint
app.get("/health-check", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Endpoint to send an email
app.get(
  `/send-email?key=${process.env.CRON_API_KEY}`,
  sendEmailLimiter,
  async (req, res) => {
    if (req.query.key !== process.env.CRON_API_KEY) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const results = await runEmailJob();
      res.status(200).json({
        message: "Email job completed",
        results: {
          sent: results.sent,
          skipped: results.skipped,
          failed: results.failed,
          invalid: results.invalid,
        },
      });
    } catch (error) {
      logger.error(`Error in send-email endpoint: ${error.message}`);
      res.status(500).json({
        message: "Error processing email job",
        error: error.message,
      });
    }
  }
);

//unsubscribe endpoint
app.get("/unsubscribe", (req, res) => {
  const email = req.query.email ? decodeURIComponent(req.query.email) : null;
  if (!email || typeof email !== "string" || !validator.isEmail(email)) {
    logger.error(`Invalid or missing email parameter: ${email}`);
    return res.status(400).send("A valid email is required");
  }
  logger.info(`Unsubscribe request received for ${email}`);
  res.send("You have been unsubscribed. Thank you!");
  // TODO: Add logic to remove email from recipients list later
});

// Example Route
app.get("/example-route", (req, res, next) => {
  // Some code that might throw an error
  throw new Error("Example error");
});

// Schedule the email at 7:00 AM daily!
cron.schedule(
  "45 6 * * *",
  async () => {
    try {
      logger.info("Running runEmailJob at 7:00 AM Asia/Kolkata timezone");
      await runEmailJob();
    } catch (error) {
      logger.error("Error in scheduled task:", error);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);

// Clean up tracker entries older than 7 days every Sunday at 3:00 AM Asia/Kolkata timezone
cron.schedule("0 3 * * 0", cleanupOldEntries, {
  timezone: "Asia/Kolkata",
});

//testing porpuse for locally
// cron.schedule(
//   "* * * * *",
//   async () => {
//     try {
//       logger.info("Running runEmailJob at 7:00 AM Asia/Kolkata timezone");
//       await runEmailJob();
//     } catch (error) {
//       logger.error("Error in scheduled task:", error);
//     }
//   },
//   {
//     timezone: "Asia/Kolkata",
//   }
// );

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Error:", err);
  res.status(500).send("Internal Server Error");
});

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});
