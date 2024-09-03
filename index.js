const express = require("express");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// file imports
const {
  updateCache,
  getNewRandomQuote,
  cache,
} = require("./helper/shared-data");
const { generateRandomMessageID } = require("./helper/util");
const { createTransporter } = require("./config/email-config");

// Express app
const app = express();
const port = process.env.PORT || 3000;

// Email Configuration
const transporter = createTransporter();

// Email Template
const folderName = "email-html-template";
const emailTemplatePath = path.join(folderName, "email-template.html");
const emailTemplate = fs.readFileSync(emailTemplatePath, "utf8");

// Default Message for root URL
app.get("/", (req, res) => {
  res.send(`Hit The Send Email Endpoint to receive the email!`);
});

// Example Route
app.get("/example-route", (req, res, next) => {
  // Some code that might throw an error
  throw new Error("Example error");
});

// Endpoint to send an email
app.get("/send-email", (req, res) => {
  const randomQuote = getNewRandomQuote();

  // Send email
  const mailOptions = {
    from: `Eureka! ${process.env.FROM_USER}`,
    to: `Priyanshu ${process.env.TO_USER}`, // Replace with your email
    // subject: `Your Morning Routine: ${randomQuote} - ${new Date().toLocaleTimeString()}`,
    // html: emailTemplate,
    headers: {
      "Content-Type": "text/html",
      "In-Reply-To": "",
      "Message-ID": `<${generateRandomMessageID()}@example.com>`,
      "If-Modified-Since": `<${randomQuote}>`,
    },
  };

  // Remove the cached value
  // TODO: it's not empacting anyway if I delete the lastSentQuote but, I'm keeping it to understand it later!
  //! and done this changes to update the value where it is resolved no any special changes, but want to understand more of it :) later!
  cache.delete("lastSentQuote");

  //dynamic mail options
  mailOptions.subject = `Your Morning Routine: ${randomQuote} - ${new Date().toLocaleTimeString()}`;
  mailOptions.html = emailTemplate;

  // Send email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
      res.status(500).send("Error sending email: " + error.toString());
    } else {
      // keeping track of lastSentQuote in case either can do in global separate file or can write in separate file system and fetch the same!
      const key = "lastSentQuote";
      const value = randomQuote;
      updateCache(key, value);

      console.log("Email sent successfully to:", info.accepted);
      res.send("Email sent successfully to: Priyanshu");
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).send("Internal Server Error");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
