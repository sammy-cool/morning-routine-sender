// routes/push.routes.js
const express = require("express");
const router = express.Router();
const { requireSubscriberSession } = require("../middleware/subscriberSession");
const pushController = require("../controllers/push.controller");

// Public VAPID key
router.get("/api/push/vapid-public-key", pushController.getVapidPublicKey);

// Authenticated push subscription endpoints
router.post("/api/push/subscribe", requireSubscriberSession, pushController.subscribe);
router.post("/api/push/unsubscribe", requireSubscriberSession, pushController.unsubscribe);
router.post("/api/push/send-test", requireSubscriberSession, pushController.sendTestPush);

module.exports = router;
