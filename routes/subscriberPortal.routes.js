const express = require("express");
const router = express.Router();

let { sendEmailLimiter, authLimiter } = require("../middleware/rateLimiters");
if (!authLimiter) authLimiter = (req, res, next) => next();
const { requireSubscriberSession } = require("../middleware/subscriberSession");
const { checkHoneypot } = require("../middleware/honeypot");
const authController = require("../controllers/subscriberAuth.controller");
const signupController = require("../controllers/signup.controller");
const meController = require("../controllers/me.controller");
const routineController = require("../controllers/routine.controller");

// Honeypot runs BEFORE the rate limiter and the controller -- a caught
// bot never even touches the real rate-limit counter or triggers a real
// email-send attempt. Response shapes match exactly what each real
// controller already returns on success, so detection is invisible.
router.post(
  "/login",
  checkHoneypot("website", {
    message: "If that email is subscribed, a login link has been sent.",
  }),
  sendEmailLimiter,
  authController.requestLogin,
);
router.get("/verify-login", authLimiter, authController.verifyLogin);
router.post("/logout", authController.logout);

router.post(
  "/subscribe",
  checkHoneypot("website", {
    message: "Check your inbox to confirm your subscription.",
  }),
  sendEmailLimiter,
  signupController.requestSignup,
);
router.get("/confirm-subscription", authLimiter, signupController.confirmSignup);

// 1-Click Habit Streak Check-in & Live Interactive Routine View
router.get("/checkin", routineController.checkin);
router.get("/routine", routineController.liveRoutine);

router.get("/me", requireSubscriberSession, meController.getMe);
router.get("/me/history", requireSubscriberSession, meController.getMyHistory);
router.patch("/me", requireSubscriberSession, meController.updateMe);

module.exports = router;
