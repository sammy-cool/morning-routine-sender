/**
 * Returns Express middleware that checks for a filled-in honeypot field
 * (a form field that's hidden from real users via CSS, but visible to
 * bots that blindly fill in every input they find) and short-circuits
 * with the exact same response a real success would give -- so a bot
 * gets no signal that it was detected, and can't tell honeypot-rejection
 * apart from "the email doesn't exist" or any other generic response
 * these routes already return by design.
 *
 * Deliberately not a CAPTCHA: this app doesn't need an external service
 * (and the API keys/setup that comes with one) for what a form field and
 * a bit of CSS already solves reasonably well for a small personal
 * project. A determined, human-operated abuser can still get through --
 * this raises the bar against automated/scripted abuse, not all abuse.
 *
 * Uses console.warn rather than the app's winston logger -- kept
 * dependency-free on purpose so this file has no risk of ever needing to
 * touch logger.js's internals.
 *
 * @param {string} fieldName - name of the hidden honeypot input
 * @param {object} genericResponse - the exact response shape/body this
 *   route already returns on "success" (real or fake), so detection is
 *   invisible from the outside.
 */
function checkHoneypot(fieldName, genericResponse) {
  return function (req, res, next) {
    const value = req.body?.[fieldName];
    if (value) {
      console.warn("Honeypot triggered, likely a bot", {
        path: req.originalUrl,
        ip: req.ip,
      });
      return res.json(genericResponse);
    }
    next();
  };
}

module.exports = { checkHoneypot };
