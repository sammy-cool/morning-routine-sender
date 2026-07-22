const express = require("express");
const router = express.Router();

const { requireAdmin } = require("../middleware/requireAdmin");
const subscribersController = require("../controllers/subscribers.controller");
const subscriberStatsController = require("../controllers/subscriberStats.controller");

router.get(
  "/admin/subscribers/stats",
  requireAdmin,
  subscriberStatsController.getSubscriberStats,
);
router.get(
  "/admin/subscribers",
  requireAdmin,
  subscribersController.listSubscribers,
);
router.post(
  "/admin/subscribers",
  requireAdmin,
  subscribersController.addSubscriber,
);
router.patch(
  "/admin/subscribers/:email",
  requireAdmin,
  subscribersController.updateSubscriber,
);
router.delete(
  "/admin/subscribers/:email",
  requireAdmin,
  subscribersController.deleteSubscriber,
);

module.exports = router;
