// routes/webhook.routes.js
const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhook.controller");

router.post("/resend", webhookController.handleResendWebhook);
router.post("/sendgrid", webhookController.handleSendGridWebhook);
router.post("/brevo", webhookController.handleBrevoWebhook);
router.post("/generic", webhookController.handleGenericWebhook);

module.exports = router;
