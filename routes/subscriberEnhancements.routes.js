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

// Personalized Podcast RSS Feed
router.get("/feed/podcast/:token", briefingController.getPodcastFeed);
router.get("/feed/podcast/:token.xml", briefingController.getPodcastFeed);
router.get("/api/me/podcast-feed", requireSubscriberAuth, (req, res) =>
  briefingController.getPodcastFeed(req, res),
);

// 5-Pillar Consistency Radar Chart SVG
const meController = require("../controllers/me.controller");
const resolveSessionOrToken = async (req, res, next) => {
  if (req.subscriberEmail) return next();
  try {
    const { getSubscriberAuthEmail } = require("../middleware/subscriberSession");
    const email = await getSubscriberAuthEmail(req);
    if (email) req.subscriberEmail = email;
  } catch (_e) {
    // ignore session resolution failure
  }
  next();
};
router.get("/api/me/radar.svg", resolveSessionOrToken, meController.getRadarChart);
router.get("/radar/:email/radar.svg", meController.getRadarChart);
router.get("/radar/:token.svg", meController.getRadarChart);

module.exports = router;
