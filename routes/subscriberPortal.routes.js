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
router.post("/checkin", routineController.checkin);
router.post("/api/subscribers/checkin", routineController.checkin);
router.get("/routine", routineController.liveRoutine);

// Dynamic Social Streak Badge SVG
router.get("/api/streak-card", meController.getStreakCard);
router.get("/api/streak-card.svg", meController.getStreakCard);

// Authenticated Subscriber Portal Endpoints
router.get("/me", requireSubscriberSession, meController.getMe);
router.get("/me/history", requireSubscriberSession, meController.getMyHistory);
router.get("/me/export-journal", requireSubscriberSession, meController.exportJournal);
router.patch("/me", requireSubscriberSession, meController.updateMe);
router.post("/me/channels", requireSubscriberSession, meController.updateChannels);
router.post("/api/channels/test", requireSubscriberSession, meController.testChannel);

module.exports = router;
