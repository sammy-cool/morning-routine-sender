// routes/deliverability.routes.js
const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../middleware/requireAdmin");
const deliverabilityController = require("../controllers/deliverability.controller");

router.use(requireAdmin);

router.get("/dns-audit", deliverabilityController.getDnsAudit);
router.get("/telemetry-stats", deliverabilityController.getTelemetryStats);
router.get("/telemetry-overview", deliverabilityController.getTelemetryOverview);
router.get("/recent-events", deliverabilityController.getRecentEvents);
router.post("/retry-failed", deliverabilityController.retryFailedDispatches);
router.post("/unsuppress", deliverabilityController.unsuppressEmail);

module.exports = router;
