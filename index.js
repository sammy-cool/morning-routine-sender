require("dotenv").config();
const express = require("express");
const compression = require("compression");
const cron = require("node-cron");
const rateLimit = require("express-rate-limit");

const { runEmailJob } = require("./email-core/emailJobs");
const { cleanupOldEntries } = require("./email-core/emailTracker");

// Express app
const app = express();
app.use(compression());
const port = process.env.PORT || 3000;

// Rate limiter for /send-email
const sendEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Allow 5 requests per IP
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

// Default Message for root URL
app.get("/", (req, res) => {
  const domain = req.protocol + "://" + req.get("host");
  console.log("Domain:", domain);

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
app.get("/send-email", sendEmailLimiter, async (req, res) => {
  try {
    await runEmailJob(); // Wait for the runEmailJob function to complete
    res.send("Email sent successfully!");
  } catch (error) {
    res.status(500).send("Error sending email: " + error.toString());
  }
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
      console.log("Running runEmailJob at 7:00 AM Asia/Kolkata timezone");
      await runEmailJob();
    } catch (error) {
      console.error("Error in scheduled task:", error);
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
//       console.log("Running runEmailJob at 7:00 AM Asia/Kolkata timezone");
//       await runEmailJob();
//     } catch (error) {
//       console.error("Error in scheduled task:", error);
//     }
//   },
//   {
//     timezone: "Asia/Kolkata",
//   }
// );

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).send("Internal Server Error");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
