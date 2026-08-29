// routes/weeklyDigest.routes.js
const express = require("express");
const router = express.Router();
const { sendEmailLimiter } = require("../middleware/rateLimiters");
const weeklyDigestController = require("../controllers/weeklyDigest.controller");

// Preview testing endpoint
router.get("/api/weekly-digest/preview", weeklyDigestController.previewWeeklyDigest);

// Batch & Single manual/cron dispatch triggers
router.post("/api/weekly-digest/dispatch", sendEmailLimiter, weeklyDigestController.dispatchBatch);
router.post(
  "/api/weekly-digest/send-batch",
  sendEmailLimiter,
  weeklyDigestController.dispatchBatch,
);
router.post("/api/weekly-digest/send-single", sendEmailLimiter, weeklyDigestController.sendSingle);

module.exports = router;
