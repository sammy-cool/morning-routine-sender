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

// Dynamic Social Streak Badge SVG & Weekly Habit Report Card SVG
router.get("/api/streak-card", meController.getStreakCard);
router.get("/api/streak-card.svg", meController.getStreakCard);
router.get("/api/streak-card/:email/card.svg", meController.getStreakCard);
router.get("/api/weekly-report", meController.getWeeklyReportCard);
router.get("/api/weekly-report.svg", meController.getWeeklyReportCard);
router.get("/api/weekly-report/:email/card.svg", meController.getWeeklyReportCard);

// Public AI Coach Personas Registry
router.get("/api/coach-personas", meController.getCoachPersonas);

// Authenticated Subscriber Portal Endpoints
router.get("/me", requireSubscriberSession, meController.getMe);
router.get("/me/history", requireSubscriberSession, meController.getMyHistory);
router.get("/me/export-journal", requireSubscriberSession, meController.exportJournal);
router.get("/me/export", requireSubscriberSession, meController.exportJournal);
router.get("/me/calendar.ics", requireSubscriberSession, meController.exportCalendar);
router.get("/me/calendar", requireSubscriberSession, meController.exportCalendar);
router.get("/calendar/feed/:token", meController.getCalendarFeedByToken);
router.get("/me/streak-card", requireSubscriberSession, meController.getMyStreakCard);
router.get("/me/weekly-report.svg", requireSubscriberSession, meController.getMyWeeklyReportCard);
router.get("/me/weekly-report", requireSubscriberSession, meController.getMyWeeklyReportCard);
router.patch("/me", requireSubscriberSession, meController.updateMe);
router.patch("/me/preferences", requireSubscriberSession, meController.updateMe);
router.post("/me/preferences", requireSubscriberSession, meController.updateMe);
router.post("/me/coach-persona", requireSubscriberSession, meController.updateCoachPersona);
router.post("/me/channels", requireSubscriberSession, meController.updateChannels);
router.patch("/me/channels", requireSubscriberSession, meController.updateChannels);
router.post("/api/channels/test", requireSubscriberSession, meController.testChannel);
router.post("/me/vacation/pause", requireSubscriberSession, meController.pauseVacation);
router.post("/api/me/vacation/pause", requireSubscriberSession, meController.pauseVacation);
router.post("/me/vacation/resume", requireSubscriberSession, meController.resumeVacation);
router.post("/api/me/vacation/resume", requireSubscriberSession, meController.resumeVacation);
router.get("/me/milestones", requireSubscriberSession, meController.getMilestones);
router.get("/api/me/milestones", requireSubscriberSession, meController.getMilestones);

router.post("/me/outbound-webhook", requireSubscriberSession, meController.updateOutboundWebhook);
router.post(
  "/api/outbound-webhook/test",
  requireSubscriberSession,
  meController.testOutboundWebhook,
);

// Streak Freeze Shield Endpoints
router.get(
  "/me/streak-freeze/status",
  requireSubscriberSession,
  meController.getStreakFreezeStatus,
);
router.post("/me/streak-freeze/use", requireSubscriberSession, meController.useStreakFreeze);
router.post("/me/use-streak-freeze", requireSubscriberSession, meController.useStreakFreeze);

module.exports = router;
