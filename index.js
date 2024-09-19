const express = require("express");
const { sendEmail } = require("./scheduled-jobs/email-jobs");
require("dotenv").config();
const cron = require("node-cron");
const compression = require("compression");

// Express app
const app = express();
app.use(compression());
const port = process.env.PORT || 3000;

// Default Message for root URL
app.get("/", (req, res) => {
  const domain = req.protocol + "://" + req.get("host");
  console.log("Domain:", domain);
  const endpointLink = `${domain}/send-email`;
  res.send(`
    <html>
      <head>
        <title>Send Email</title>
      </head>
      <body>
        <h1>Hit The Send Email Endpoint to receive the email!</h1>
        <a href="${endpointLink}" target="_blank">Send Email</a>
      </body>
    </html>
  `);
});

// Endpoint to send an email
app.get("/send-email", async (req, res) => {
  try {
    sendEmail(); // Wait for the sendEmail function to complete
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

// Schedule the email to be sent daily at 6:55 AM
cron.schedule("25 1 * * *", () => {
  console.log("Running a task every day at 6:55 AM");
  sendEmail();
});

//! Schedule a job to run every minute testing purpose only
// cron.schedule('* * * * *', () => {
//   console.log('Running a task every minute');
// Add logic here to check if the current time is 30 seconds past the minute mark
// For testing purposes, you might use setTimeout within this job
//   setTimeout(() => {
//     console.log('Running a test task 30 seconds after the minute');
//     sendEmail();
//   }, 30000); // 30 seconds
// });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).send("Internal Server Error");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
