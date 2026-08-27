const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");

const { authLimiter } = require("../middleware/rateLimiters");

router.get("/generate-admin-key", authController.generateAdminKey);
// express.json() kept here even though index.js already applies it globally --
// preserving exact original middleware chain for this route rather than
// assuming it's safe to drop.
router.post("/verify-admin-key", express.json(), authLimiter, authController.verifyAdminKey);
router.post("/secret-jobs-scheduler", authController.secretJobsScheduler);

module.exports = router;
