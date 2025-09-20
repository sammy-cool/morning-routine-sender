require("dotenv").config();
const express = require("express");
const compression = require("compression");
const cron = require("node-cron");
const rateLimit = require("express-rate-limit");
const validator = require("validator");

const logger = require("./logger");
const { runEmailJob } = require("./email-core/emailJobs");
const { cleanupOldEntries } = require("./email-core/emailTracker");
const { unsubscribeUser } = require("./lib/myLib");

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
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Email Dashboard</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/customizable-toast-notification"></script>
        <style>
          body {
            margin: 0;
            font-family: 'Poppins', sans-serif;
            background: linear-gradient(135deg, #1f1c2c, #928dab);
            color: #fff;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .container {
            text-align: center;
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(12px);
            padding: 2rem 3rem;
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.3);
            max-width: 600px;
          }
          h1 {
            margin-bottom: 2rem;
            font-weight: 600;
            font-size: 1.8rem;
          }
          #gg {
            display: block;
            width: 100%;
            padding: 14px 20px;
            margin: 12px 0;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            color: #fff;
            cursor: pointer;
            transition: all 0.3s ease-in-out;
          }
          #gg:hover {
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          }
          .unsubscribe { background: #e63946; }
          .send { background: #06d6a0; }
          .website { background: #118ab2; }
          .health { background: #ffd166; color: #333; }
        </style>
        <script>
          async function unsubscribe() {
            const res = await fetch("${domain}/unsubscribe-health");
            const data = await res.text();
            customizableToast.createToast({duration: 5000, message: data, type: "success", position: "top-full-width" , textColor: "snow"});
          }
          async function sendEmail() {
          
            performDataSync = async (key = null) => {
            const url = key ? \`${domain}/send-email?key=\${encodeURIComponent(key)}\` : \`${domain}/send-email\`;
              const res = await fetch(url);
              const data = await res.text();
              customizableToast.createToast({animationDuration: 2000,  duration: 8000, message: data, type: "success", position: "top-full-width" , textColor: "snow"});
            }
            customizableToast.createToast({
              duration: 5000,
              message: 'Click to send email Manually',
              type: "info",
              backgroundColor: "red",
              textColor: "snow",
              cta: {
                label: "Send Email API",
                onClick: async () => { await performDataSync() },
              },
              position: "top-full-width"
            });
            customizableToast.createToast({
              duration: 5000,
              animationDuration: 2000,
              message: 'Click to send email Manually with Key',
              type: "info",
              backgroundColor: "red",
              textColor: "snow",
              cta: {
                label: "Send Email API with Key",
                onClick: async () => { await performDataSync('eureka') },
              },
              position: "top-full-width"
            });
          }
          async function website() {
            const data = "Website Opened Successfully Connecting to priyanshu-eureka.netlify.app Congratulations!";
            websiteJump = async () => {
              window.open("https://priyanshu-eureka.netlify.app/", '_blank');
              customizableToast.createToast({duration: 5000, message: data, type: "info", position: "top-full-width" , textColor: "snow"});
            }
            customizableToast.createToast({
              duration: 5000,
              message: "Click to open website",
              type: "info",
              backgroundColor: "red",
              textColor: "snow",
              cta: {
                label: "Website Jump!",
                onClick: async () => { await websiteJump() },
              },
              position: "top-full-width"
            });
          }
          async function healthCheck() {
            performDataSync = async () => {
              const res = await fetch("${domain}/health-check");
              const data = await res.text();
              customizableToast.createToast({duration: 5000, message: data, type: "success", position: "top-full-width" , textColor: "snow"});
            }
            customizableToast.createToast({
              duration: 5000,
              message: 'Click to health check of the APP',
              type: "info",
              backgroundColor: "red",
              textColor: "snow",
              cta: {
                label: "Health Check API",
                onClick: async () => { await performDataSync() },
              },
              position: "top-full-width"
            });
          }
        </script>
      </head>
      <body>
        <div class="container">
          <h1>🚀 Email & API Dashboard</h1>
          <button id="gg" class="unsubscribe" onclick="unsubscribe()">Unsubscribe</button>
          <button id="gg" class="send" onclick="sendEmail()">Send Email</button>
          <button id="gg" class="website" onclick="website()">Open Website</button>
          <button id="gg" class="health" onclick="healthCheck()">Health Check</button>
        </div>
      </body>
    </html>
  `);
});

app.get("/unsubscribe-health", (req, res) => {
  const email = req.query.email || "unknown@example.com";
  const message = unsubscribeUser(email);
  res.send(message);
});

// Health-check endpoint
app.get("/health-check", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Endpoint to send an email
app.get(`/send-email`, sendEmailLimiter, async (req, res) => {
  if (req.query.key !== process.env.CRON_API_KEY) {
    logger.error("Forbidden");
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
});

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
