const express = require("express");
const router = express.Router();

const { sendEmailLimiter } = require("../middleware/rateLimiters");
const adminController = require("../controllers/admin.controller");

router.get("/read-db", sendEmailLimiter, adminController.readDb);
router.post("/admin/cleanup-database", adminController.cleanupDatabase);
router.get("/admin/database-stats", adminController.getDatabaseStats);
router.post("/admin/cleanup-logs", adminController.cleanupLogs);

module.exports = router;
