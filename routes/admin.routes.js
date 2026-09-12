const express = require("express");
const router = express.Router();

const { sendEmailLimiter } = require("../middleware/rateLimiters");
const adminController = require("../controllers/admin.controller");
const deliverabilityController = require("../controllers/deliverability.controller");
const weeklyDigestController = require("../controllers/weeklyDigest.controller");
const { requireAdmin } = require("../middleware/requireAdmin");

router.get("/read-db", sendEmailLimiter, adminController.readDb);
router.post("/admin/cleanup-database", requireAdmin, adminController.cleanupDatabase);
router.get("/admin/database-stats", requireAdmin, adminController.getDatabaseStats);
router.post("/admin/cleanup-logs", requireAdmin, adminController.cleanupLogs);

// Admin Telemetry & Dead-Letter Retry Endpoints
router.get(
  "/admin/api/telemetry-overview",
  requireAdmin,
  deliverabilityController.getTelemetryOverview,
);
router.get("/admin/api/recent-events", requireAdmin, deliverabilityController.getRecentEvents);
router.post(
  "/admin/api/retry-failed",
  requireAdmin,
  deliverabilityController.retryFailedDispatches,
);
router.post(
  "/admin/api/trigger-weekly-digest",
  requireAdmin,
  weeklyDigestController.triggerWeeklyDigest,
);
router.post("/admin/api/reschedule-all", requireAdmin, adminController.rescheduleAllCronJobs);

// Scheduler Queue & Dispatch Preview
router.get("/admin/api/scheduler/queue", requireAdmin, adminController.getSchedulerQueue);
router.post(
  "/admin/api/scheduler/dispatch-preview",
  requireAdmin,
  adminController.dispatchSinglePreview,
);

// Suppression / Blacklist Management
router.get("/admin/api/suppressions", requireAdmin, adminController.getSuppressionsList);
router.post("/admin/api/suppressions/unsuppress", requireAdmin, adminController.unsuppressEmail);

// Global Routine Announcements
router.get("/admin/api/announcements", requireAdmin, adminController.getAdminAnnouncements);
router.post("/admin/api/announcements", requireAdmin, adminController.createAnnouncement);
router.delete("/admin/api/announcements", requireAdmin, adminController.clearActiveAnnouncement);

module.exports = router;
