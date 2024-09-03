const { createTransporter } = require("../config/email-config");
const { getEmailHtmlTemplateAndUpdate, cache, getNewRandomQuote, updateCache } = require("../helper/shared-data");
const { generateRandomMessageID } = require("../helper/util");

// Email Configuration
const transporter = createTransporter();

// Function || Endpoint to send an email
const sendEmail = () => {
  const randomQuote = getNewRandomQuote();

  // Email options
  const mailOptions = {
    from: `Eureka! ${process.env.FROM_USER}`,
    to: `Priyanshu ${process.env.TO_USER}`, // Replace with your email
    subject: `Your Morning Routine: ${randomQuote} - ${new Date().toLocaleTimeString()}`,
    html: getEmailHtmlTemplateAndUpdate(),
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

  // Send email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      // Update and Track the last sent quote
      const key = "lastSentQuote";
      const value = randomQuote;
      updateCache(key, value);

      console.log("Email sent successfully to:", info.accepted);
    }
  });
};

module.exports = { sendEmail };