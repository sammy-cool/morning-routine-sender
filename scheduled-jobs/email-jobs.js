const { createTransporter } = require("../config/email-config");
const {
  getEmailHtmlTemplateAndUpdate,
  cache,
  getNewRandomQuote,
  updateCache,
} = require("../helper/shared-data");
const { generateRandomMessageID } = require("../helper/util");

// Email Configuration
const transporter = createTransporter();

// Function || Endpoint to send an email
async function sendEmail() {
  try {
    const randomQuote = await getNewRandomQuote();
    const utcTime = new Date().toLocaleTimeString("en-US", { timeZone: "UTC" });

    // Email options
    const mailOptions = {
      from: `Eureka! ${process.env.FROM_USER}`,
      to: `Priyanshu ${process.env.TO_USER}`, // Replace with your email
      subject: `Your Morning Routine: ${randomQuote} - ${utcTime}`,
      html: await getEmailHtmlTemplateAndUpdate(),
      headers: {
        "Content-Type": "text/html",
        "In-Reply-To": "",
        "Message-ID": `<${generateRandomMessageID()}@example.com>`,
        "If-Modified-Since": `<${randomQuote}>`, // TODO: it's not impacting anyway neither above these #@{{"In-Reply-To","Message-ID","If-Modified-Since"}} and added these for ungroup the mail thread and last one to exclude the value from cache, But I'm keeping it to understand it later!
      },
    };

    // Remove the cached value
    // TODO: it's not impacting anyway if I delete the lastSentQuote, But I'm keeping it to understand it later!
    //! and done this changes to update the value where it is resolved no any special changes, but want to understand more of it :) later!
    cache.delete("lastSentQuote");

    // Send email using Promise to work with async-await
    const info = await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, mailInfo) => {
        if (error) {
          console.error("Error sending email:", error);
          reject(error);
        } else {
          // Update and Track the last sent quote
          const key = "lastSentQuote";
          const value = randomQuote;
          updateCache(key, value);

          console.log("Email sent successfully to:", mailInfo.accepted);
          resolve(mailInfo);
        }
      });
    });
    console.log("Email sent successfully to:", info.response);
  } catch (error) {
    console.log("Error sending email:", error);
    throw error;
  }
}

module.exports = { sendEmail };
