// controllers/deliverability.controller.js
const logger = require("../logger");
const db = require("../db/knex");
const { performDeliverabilityAudit } = require("../helper/dnsGuard");
const suppressionService = require("../email-core/suppressionService");

// GET /admin/deliverability/dns-audit
async function getDnsAudit(req, res) {
  try {
    const domainQuery = req.query.domain || process.env.FROM_USER;
    const auditResult = await performDeliverabilityAudit(domainQuery);
    return res.json({ success: true, data: auditResult });
  } catch (error) {
    logger.error("Deliverability DNS Audit failed", { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /admin/deliverability/telemetry-stats
async function getTelemetryStats(req, res) {
  try {
    const days = parseInt(req.query.days || "7", 10);
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let eventsBreakdown = [];
    let suppressionCount = { total: 0 };
    let recentBounces = [];

    const hasEvents = await db.schema.hasTable("email_events");
    if (hasEvents) {
      eventsBreakdown = await db("email_events")
        .where("occurred_at", ">=", sinceDate)
        .select("event_type")
        .count("id as count")
        .groupBy("event_type");
    }

    const hasSuppression = await db.schema.hasTable("suppression_list");
    if (hasSuppression) {
      suppressionCount = await db("suppression_list").count("id as total").first();
      recentBounces = await db("suppression_list")
        .orderBy("suppressed_at", "desc")
        .limit(10)
        .select("email", "reason", "bounce_code", "diagnostic_reason", "suppressed_at");
    }

    const stats = {
      delivered: 0,
      opened: 0,
      clicked: 0,
      soft_bounce: 0,
      hard_bounce: 0,
      spam_complaint: 0,
    };

    for (const row of eventsBreakdown) {
      if (stats[row.event_type] !== undefined) {
        stats[row.event_type] = parseInt(row.count, 10);
      }
    }

    const totalDispatched = stats.delivered + stats.soft_bounce + stats.hard_bounce;
    const deliveryRate = totalDispatched > 0 ? ((stats.delivered / totalDispatched) * 100).toFixed(2) : "100.00";
    const openRate = stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(2) : "0.00";
    const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(2) : "0.00";
    const bounceRate = totalDispatched > 0 ? (((stats.soft_bounce + stats.hard_bounce) / totalDispatched) * 100).toFixed(2) : "0.00";

    return res.json({
      success: true,
      timeframeDays: days,
      metrics: {
        totalDispatched,
        deliveryRate: `${deliveryRate}%`,
        openRate: `${openRate}%`,
        clickRate: `${clickRate}%`,
        bounceRate: `${bounceRate}%`,
        totalSuppressed: parseInt(suppressionCount?.total || 0, 10),
      },
      rawCounts: stats,
      recentBounces,
    });
  } catch (error) {
    logger.error("Failed to fetch telemetry stats", { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

// POST /admin/deliverability/unsuppress
async function unsuppressEmail(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const result = await suppressionService.unsuppressEmail(email, "admin");
    return res.json({ success: true, message: `Email ${email} removed from suppression list and reactivated.` });
  } catch (error) {
    logger.error("Failed to unsuppress email", { email, error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getDnsAudit,
  getTelemetryStats,
  unsuppressEmail,
};
