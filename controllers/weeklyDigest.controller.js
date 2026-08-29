// controllers/weeklyDigest.controller.js
const weeklyDigestService = require("../helper/weeklyDigestService");
const sharedData = require("../helper/shared-data");
const logger = require("../logger");
const { safeCompare } = require("../helper/util");

function isAuthorizedAdminOrCron(req) {
  const isAdminSession = req.signedCookies?.mrn_role === "admin";
  const expectedKey = process.env.CRON_API_KEY || process.env.ADMIN_KEY;
  const apiKey = req.get("x-cron-key") || req.get("x-admin-secret") || req.query.key;
  return Boolean(isAdminSession || (expectedKey && apiKey && safeCompare(apiKey, expectedKey)));
}

/**
 * GET /api/weekly-digest/preview
 * Allows testing and live browser preview of compiled weekly digest HTML or JSON model
 */
async function previewWeeklyDigest(req, res) {
  try {
    const email = req.query.email || "demo.builder@example.com";
    const track = req.query.track || "deep-work";
    const format = req.query.format || "html";

    let subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      subscriber = {
        email,
        name: "Alex Vance",
        routineTrack: track,
        templateType: track,
        streakCount: 7,
        timezone: req.query.timezone || "America/New_York",
        isActive: true,
      };
    }

    const payload = await weeklyDigestService.buildWeeklyDigestPayload(subscriber, req.app.locals);

    if (format === "json") {
      return res.json({ success: true, payload });
    }

    const { html } = await weeklyDigestService.renderWeeklyDigestHtml(payload);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (error) {
    logger.error("Weekly digest preview error:", { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/weekly-digest/dispatch
 * Batch trigger endpoint for cron or admin dispatch
 */
async function dispatchBatch(req, res) {
  if (!isAuthorizedAdminOrCron(req)) {
    return res.status(403).json({ error: "Forbidden: admin access or valid API key required" });
  }

  try {
    const force = req.query.force === "true";
    const result = await weeklyDigestService.dispatchWeeklyDigestBatch(req.app.locals, { force });
    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error("Batch weekly digest dispatch failed:", { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/weekly-digest/send-single
 * Dispatch weekly digest to a specific subscriber
 */
async function sendSingle(req, res) {
  if (!isAuthorizedAdminOrCron(req)) {
    return res.status(403).json({ error: "Forbidden: admin access or valid API key required" });
  }

  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    let subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      subscriber = {
        email,
        routineTrack: req.body.track || "deep-work",
        streakCount: Number(req.body.streakCount) || 1,
        timezone: req.body.timezone || "UTC",
        isActive: true,
      };
    }

    const result = await weeklyDigestService.sendWeeklyDigestToSubscriber(
      subscriber,
      req.app.locals,
      {
        force: true,
      },
    );
    return res.json({ success: true, result });
  } catch (error) {
    logger.error("Single weekly digest send failed:", { error: error.message, email });
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  previewWeeklyDigest,
  dispatchBatch,
  sendSingle,
};
