const nodemailer = require("nodemailer");
require("dotenv").config();

function createTransporter() {
  const transporter = nodemailer.createTransport({
    host: process.env.TRANSPORTER_HOST,
    auth: {
      user: process.env.FROM_USER,
      pass: process.env.PASSWORD,
    },
  });

  return transporter;
}
module.exports = { createTransporter };
