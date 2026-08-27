const express = require("express");
const router = express.Router();

const { sendEmailLimiter } = require("../middleware/rateLimiters");
const { requireAdmin } = require("../middleware/requireAdmin");
const emailController = require("../controllers/email.controller");

router.post("/send-test-email", sendEmailLimiter, emailController.sendTestEmail);
router.get("/unsubscribe", emailController.unsubscribe);
router.get("/scheduled-jobs", requireAdmin, emailController.scheduledJobs);
router.post("/send-bulk-now", sendEmailLimiter, emailController.sendBulkNow);

module.exports = router;
