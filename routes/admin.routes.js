const express = require("express");
const router = express.Router();

const { sendEmailLimiter } = require("../middleware/rateLimiters");
const adminController = require("../controllers/admin.controller");
const { requireAdmin } = require("../middleware/requireAdmin");

router.get("/read-db", sendEmailLimiter, adminController.readDb);
router.post("/admin/cleanup-database", requireAdmin, adminController.cleanupDatabase);
router.get("/admin/database-stats", requireAdmin, adminController.getDatabaseStats);
router.post("/admin/cleanup-logs", requireAdmin, adminController.cleanupLogs);

module.exports = router;
