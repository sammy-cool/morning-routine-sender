const express = require("express");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Email Configuration
const transporter = nodemailer.createTransport({
  host: process.env.TRANSPORTER_HOST,
  //   port: process.env.TRANSPORTER_PORT,
  //   secure: process.env.TRANSPORTER_SECURE, // upgrade later with STARTTLS
  auth: {
    user: process.env.FROM_USER,
    pass: process.env.PASSWORD,
  },
});

// Your morning routine recommendation
const morningRoutine = `
Here's your personalized morning routine to increase productivity:

1. Gradual Wake-Up (9:00 AM - 9:10 AM)
2. Hydrate & Refresh (9:10 AM - 9:20 AM)
3. Energizing Yoga (9:20 AM - 9:40 AM)
4. Mindful Meditation (9:40 AM - 9:50 AM)
5. Light Breakfast (9:50 AM - 10:00 AM)
6. Set Daily Intentions (10:00 AM)
`;

// Endpoint to send an email
app.get("/send-email", (req, res) => {
  const mailOptions = {
    from: process.env.FROM_USER,
    to: process.env.TO_USER, // Replace with your email
    subject: "Your Morning Routine",
    text: morningRoutine,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).send("Error sending email: " + error.toString());
    }
    res.send("Email sent successfully to: Priyanshu");
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
