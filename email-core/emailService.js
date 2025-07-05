const logger = require("../logger");
const { createTransporter } = require("../config/email-config");
const {
  cache,
  getEmailHtmlTemplateAndUpdate,
  getNewRandomQuote,
  updateCache,
} = require("../helper/shared-data");
const { generateRandomMessageID } = require("../helper/util");

const transporter = createTransporter();

async function generateEmailOptions(toEmail, randomQuote) {
  const IST_Time = new Date().toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  const domain = process.env.RENDER_DOMAIN || "http://localhost:3000";
  const unsubscribeLink = `${domain}/unsubscribe?email=${encodeURIComponent(
    toEmail
  )}`;

  return {
    from: `Eureka! ${process.env.FROM_USER}`,
    to: `Priyanshu ${toEmail}`,
    subject: `Your Morning Routine: ${randomQuote} - ${IST_Time}`,
    html: await getEmailHtmlTemplateAndUpdate(unsubscribeLink),
    headers: {
      "Content-Type": "text/html",
      "In-Reply-To": "",
      "Message-ID": `<${generateRandomMessageID()}@example.com>`,
      "If-Modified-Since": `<${randomQuote}>`,
    },
  };
}

async function sendEmail(mailOptions, randomQuote) {
  try {
    cache.delete("lastSentQuote");

    const info = await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, mailInfo) => {
        if (error) {
          logger.error(`Error sending email: ${error.message}`);
          reject(error);
        } else {
          updateCache("lastSentQuote", randomQuote);
          logger.info(`Email sent successfully to: ${mailInfo.accepted}`);
          resolve(mailInfo);
        }
      });
    });

    return info;
  } catch (error) {
    logger.error(`Failed to send email: ${error.message}`);
    throw error;
  }
}

async function sendEmailFn(toEmail) {
  logger.info("Preparing to send email...");
  try {
    const randomQuote = await getNewRandomQuote();
    const mailOptions = await generateEmailOptions(toEmail, randomQuote);
    const info = await sendEmail(mailOptions, randomQuote);
    return info;
  } catch (error) {
    logger.error(`Error in sendEmailFn: ${error.message}`);
    throw error;
  }
}

module.exports = { sendEmailFn };
