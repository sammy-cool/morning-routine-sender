const express = require("express");
const router = express.Router();

const { sendEmailLimiter } = require("../middleware/rateLimiters");
const { requireAdmin } = require("../middleware/requireAdmin");
const { checkHoneypot } = require("../middleware/honeypot");
const emailController = require("../controllers/email.controller");

router.post("/send-test-email", sendEmailLimiter, emailController.sendTestEmail);
router.get("/unsubscribe", emailController.unsubscribe);
router.post("/unsubscribe", emailController.unsubscribe);
router.post(
  "/unsubscribe/request",
  checkHoneypot("website", {
    message: "If that email is subscribed, a link has been sent.",
  }),
  sendEmailLimiter,
  emailController.requestUnsubscribe,
);
router.get("/scheduled-jobs", requireAdmin, emailController.scheduledJobs);
router.post("/send-bulk-now", sendEmailLimiter, emailController.sendBulkNow);

module.exports = router;
