// routes/subscriberEnhancements.routes.js
const express = require("express");
const router = express.Router();
const { requireSubscriberAuth } = require("../middleware/subscriberSession");
const analyticsController = require("../controllers/analytics.controller");
const briefingController = require("../controllers/briefing.controller");

// Habit Analytics & Time-of-Day Insights API
router.get("/api/me/analytics", requireSubscriberAuth, analyticsController.getSubscriberAnalytics);

// AI Morning Audio Briefing API
router.get("/api/me/briefing", requireSubscriberAuth, briefingController.getDailyBriefing);

module.exports = router;
