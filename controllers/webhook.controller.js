// controllers/webhook.controller.js
const logger = require("../logger");
const suppressionService = require("../email-core/suppressionService");
const {
  verifyHmacSignature,
  parseResendPayload,
  parseSendGridPayload,
  parseBrevoPayload,
  parseGenericPayload,
} = require("../helper/webhookParsers");
const { safeCompare } = require("../helper/util");

async function processWebhookEvents(req, res, events, providerName) {
  if (!events || events.length === 0) {
    return res.status(200).json({ received: true, processed: 0 });
  }

  let processedCount = 0;
  let errorCount = 0;

  for (const event of events) {
    try {
      await suppressionService.processTelemetryEvent(event);
      processedCount++;
    } catch (err) {
      errorCount++;
      logger.error(`Error processing ${providerName} event`, {
        error: err.message,
        event,
      });
    }
  }

  logger.info(
    `📡 Webhook [${providerName}] processed ${processedCount} events (${errorCount} errors)`,
  );
  return res.status(200).json({
    received: true,
    processed: processedCount,
    errors: errorCount,
  });
}

// POST /api/webhooks/resend
async function handleResendWebhook(req, res) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.get("resend-signature") || req.get("svix-signature");
    if (!signature || !verifyHmacSignature(req.body, signature, secret)) {
      logger.warn("Unauthorized Resend webhook signature");
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  try {
    const events = parseResendPayload(req.body);
    return await processWebhookEvents(req, res, events, "Resend");
  } catch (err) {
    logger.error("Resend webhook parsing failed", { error: err.message });
    return res.status(400).json({ error: "Invalid payload" });
  }
}

// POST /api/webhooks/sendgrid
async function handleSendGridWebhook(req, res) {
  const secret = process.env.SENDGRID_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.get("X-Twilio-Email-Event-Webhook-Signature");
    const timestamp = req.get("X-Twilio-Email-Event-Webhook-Timestamp");
    if (signature && timestamp) {
      const payloadToSign = timestamp + JSON.stringify(req.body);
      if (!verifyHmacSignature(payloadToSign, signature, secret)) {
        logger.warn("Unauthorized SendGrid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }
  }

  try {
    const events = parseSendGridPayload(req.body);
    return await processWebhookEvents(req, res, events, "SendGrid");
  } catch (err) {
    logger.error("SendGrid webhook parsing failed", { error: err.message });
    return res.status(400).json({ error: "Invalid payload" });
  }
}

// POST /api/webhooks/brevo
async function handleBrevoWebhook(req, res) {
  const expectedKey = process.env.BREVO_WEBHOOK_KEY;
  if (expectedKey) {
    const authHeader = req.get("X-Brevo-Signature") || req.get("X-Sib-Signature") || req.query.key;
    if (!authHeader || !safeCompare(authHeader, expectedKey)) {
      logger.warn("Unauthorized Brevo webhook attempt");
      return res.status(401).json({ error: "Invalid webhook secret" });
    }
  }

  try {
    const events = parseBrevoPayload(req.body);
    return await processWebhookEvents(req, res, events, "Brevo");
  } catch (err) {
    logger.error("Brevo webhook parsing failed", { error: err.message });
    return res.status(400).json({ error: "Invalid payload" });
  }
}

// POST /api/webhooks/generic
async function handleGenericWebhook(req, res) {
  const secret = process.env.GENERIC_WEBHOOK_SECRET || process.env.ADMIN_KEY;
  if (secret) {
    const signature = req.get("x-webhook-signature") || req.get("x-signature");
    const apiKey = req.get("x-api-key") || req.query.key;

    const isHmacValid = signature && verifyHmacSignature(req.body, signature, secret);
    const isKeyValid = apiKey && safeCompare(apiKey, secret);

    if (!isHmacValid && !isKeyValid) {
      logger.warn("Unauthorized generic webhook attempt");
      return res.status(401).json({ error: "Unauthorized webhook" });
    }
  }

  try {
    const events = parseGenericPayload(req.body);
    return await processWebhookEvents(req, res, events, "Generic");
  } catch (err) {
    logger.error("Generic webhook parsing failed", { error: err.message });
    return res.status(400).json({ error: "Invalid payload" });
  }
}

module.exports = {
  handleResendWebhook,
  handleSendGridWebhook,
  handleBrevoWebhook,
  handleGenericWebhook,
};
