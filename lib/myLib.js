const {
  createToast,
  setDefaultColors,
} = require("customizable-toast-notification");
// const { updateTracker } = require("../email-core/emailTracker");
const { info } = require("winston");

// lib/myLib.js
function unsubscribeUser(email) {
  const userMessage = `User with email ${email} unsubscribed successfully!`;
  setDefaultColors({ info: "snow" });
  createToast({
    message: userMessage,
    type: "info",
    position: "top-full-width",
  });
  // updateTracker(email, "success", userMessage);
  return userMessage;
}

module.exports = { unsubscribeUser };
