// routes/squad.routes.js
const express = require("express");
const router = express.Router();
const { requireSubscriberAuth } = require("../middleware/subscriberSession");
const squadController = require("../controllers/squad.controller");

// Accountability Squads & Peer Streaks API
router.get("/api/me/squad", requireSubscriberAuth, squadController.getSquad);
router.post("/api/me/squad/create", requireSubscriberAuth, squadController.createSquad);
router.post("/api/me/squad/join", requireSubscriberAuth, squadController.joinSquad);
router.post("/api/me/squad/leave", requireSubscriberAuth, squadController.leaveSquad);

module.exports = router;
