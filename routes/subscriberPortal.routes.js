const express = require("express");
const router = express.Router();

const { sendEmailLimiter } = require("../middleware/rateLimiters");
const { requireSubscriberSession } = require("../middleware/subscriberSession");
const authController = require("../controllers/subscriberAuth.controller");
const signupController = require("../controllers/signup.controller");
const meController = require("../controllers/me.controller");

// Rate-limited: this endpoint triggers a real email send per request --
// without a limit, it's an easy way to spam someone's inbox with login
// links using their own email address. Same shared limiter every other
// email-triggering route already uses.
router.post("/login", sendEmailLimiter, authController.requestLogin);
router.get("/verify-login", authController.verifyLogin);
router.post("/logout", authController.logout);

router.post("/subscribe", sendEmailLimiter, signupController.requestSignup);
router.get("/confirm-subscription", signupController.confirmSignup);

router.get("/me", requireSubscriberSession, meController.getMe);
router.get("/me/history", requireSubscriberSession, meController.getMyHistory);
router.patch("/me", requireSubscriberSession, meController.updateMe);

module.exports = router;
