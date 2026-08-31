// controllers/deliverability.controller.js
const logger = require("../logger");
const db = require("../db/knex");
const { performDeliverabilityAudit } = require("../helper/dnsGuard");
const suppressionService = require("../email-core/suppressionService");
const sharedData = require("../helper/shared-data");

let isRetryingDeadLetters = false;

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

// GET /admin/deliverability/telemetry-stats (Legacy/compatibility stats endpoint)
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
    const deliveryRate =
      totalDispatched > 0 ? ((stats.delivered / totalDispatched) * 100).toFixed(2) : "100.00";
    const openRate =
      stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(2) : "0.00";
    const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(2) : "0.00";
    const bounceRate =
      totalDispatched > 0
        ? (((stats.soft_bounce + stats.hard_bounce) / totalDispatched) * 100).toFixed(2)
        : "0.00";

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

// Helper to compute percentage rate strings
function calculateDeliverabilityRates(
  sentCount,
  delivered,
  opened,
  clicked,
  softBounce,
  hardBounce,
) {
  const totalDispatched = sentCount > 0 ? sentCount : delivered + softBounce + hardBounce;
  const deliveryRate =
    totalDispatched > 0 ? ((delivered / totalDispatched) * 100).toFixed(2) : "100.00";
  const openRate = delivered > 0 ? ((opened / delivered) * 100).toFixed(2) : "0.00";
  const clickRate = opened > 0 ? ((clicked / opened) * 100).toFixed(2) : "0.00";
  const bounceRate =
    totalDispatched > 0 ? (((softBounce + hardBounce) / totalDispatched) * 100).toFixed(2) : "0.00";

  return {
    deliveryRate: `${deliveryRate}%`,
    openRate: `${openRate}%`,
    clickRate: `${clickRate}%`,
    bounceRate: `${bounceRate}%`,
  };
}

// GET /admin/api/telemetry-overview & GET /admin/deliverability/telemetry-overview
async function getTelemetryOverview(req, res) {
  try {
    const rawDays = parseInt(req.query.days || "7", 10);
    const validDays = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 90) : 7;
    const sinceDate = new Date(Date.now() - validDays * 24 * 60 * 60 * 1000);

    const since7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let trackerCounts = { total: 0, success: 0, failed: 0, retried: 0 };
    let tracker7d = { total: 0, success: 0, failed: 0 };
    let tracker30d = { total: 0, success: 0, failed: 0 };

    const hasTracker = await db.schema.hasTable("email_tracker");
    if (hasTracker) {
      const [totalCount] = await db("email_tracker")
        .where("sent_at", ">=", sinceDate)
        .count("id as count");
      const [successCount] = await db("email_tracker")
        .where("sent_at", ">=", sinceDate)
        .where("status", "success")
        .count("id as count");
      const [failedCount] = await db("email_tracker")
        .where("sent_at", ">=", sinceDate)
        .where("status", "failed")
        .count("id as count");
      const [retriedCount] = await db("email_tracker")
        .where("sent_at", ">=", sinceDate)
        .where("retry_count", ">", 0)
        .count("id as count");

      trackerCounts = {
        total: parseInt(totalCount?.count || 0, 10),
        success: parseInt(successCount?.count || 0, 10),
        failed: parseInt(failedCount?.count || 0, 10),
        retried: parseInt(retriedCount?.count || 0, 10),
      };

      const [tot7] = await db("email_tracker")
        .where("sent_at", ">=", since7Days)
        .count("id as count");
      const [succ7] = await db("email_tracker")
        .where("sent_at", ">=", since7Days)
        .where("status", "success")
        .count("id as count");
      const [fail7] = await db("email_tracker")
        .where("sent_at", ">=", since7Days)
        .where("status", "failed")
        .count("id as count");
      tracker7d = {
        total: parseInt(tot7?.count || 0, 10),
        success: parseInt(succ7?.count || 0, 10),
        failed: parseInt(fail7?.count || 0, 10),
      };

      const [tot30] = await db("email_tracker")
        .where("sent_at", ">=", since30Days)
        .count("id as count");
      const [succ30] = await db("email_tracker")
        .where("sent_at", ">=", since30Days)
        .where("status", "success")
        .count("id as count");
      const [fail30] = await db("email_tracker")
        .where("sent_at", ">=", since30Days)
        .where("status", "failed")
        .count("id as count");
      tracker30d = {
        total: parseInt(tot30?.count || 0, 10),
        success: parseInt(succ30?.count || 0, 10),
        failed: parseInt(fail30?.count || 0, 10),
      };
    }

    let eventsBreakdown = [];
    let providerBreakdownRows = [];
    let events7dRows = [];
    let events30dRows = [];

    const hasEvents = await db.schema.hasTable("email_events");
    if (hasEvents) {
      eventsBreakdown = await db("email_events")
        .where("occurred_at", ">=", sinceDate)
        .select("event_type")
        .count("id as count")
        .groupBy("event_type");

      providerBreakdownRows = await db("email_events")
        .where("occurred_at", ">=", sinceDate)
        .select("provider", "event_type")
        .count("id as count")
        .groupBy("provider", "event_type");

      events7dRows = await db("email_events")
        .where("occurred_at", ">=", since7Days)
        .select("event_type")
        .count("id as count")
        .groupBy("event_type");

      events30dRows = await db("email_events")
        .where("occurred_at", ">=", since30Days)
        .select("event_type")
        .count("id as count")
        .groupBy("event_type");
    }

    let suppressionCount = { total: 0 };
    const hasSuppression = await db.schema.hasTable("suppression_list");
    if (hasSuppression) {
      suppressionCount = await db("suppression_list").count("id as total").first();
    }

    const eventCounts = {
      delivered: 0,
      opened: 0,
      clicked: 0,
      soft_bounce: 0,
      hard_bounce: 0,
      spam_complaint: 0,
    };

    for (const row of eventsBreakdown) {
      if (eventCounts[row.event_type] !== undefined) {
        eventCounts[row.event_type] = parseInt(row.count, 10);
      }
    }

    const providerMetrics = {};
    for (const row of providerBreakdownRows) {
      const prov = row.provider || "generic";
      if (!providerMetrics[prov]) {
        providerMetrics[prov] = {
          provider: prov,
          delivered: 0,
          opened: 0,
          clicked: 0,
          soft_bounce: 0,
          hard_bounce: 0,
          spam_complaint: 0,
          total_events: 0,
        };
      }
      const count = parseInt(row.count, 10);
      if (providerMetrics[prov][row.event_type] !== undefined) {
        providerMetrics[prov][row.event_type] = count;
      }
      providerMetrics[prov].total_events += count;
    }

    const parseEventsSummary = (rows) => {
      const summary = {
        delivered: 0,
        opened: 0,
        clicked: 0,
        soft_bounce: 0,
        hard_bounce: 0,
        spam_complaint: 0,
      };
      for (const r of rows) {
        if (summary[r.event_type] !== undefined) {
          summary[r.event_type] = parseInt(r.count, 10);
        }
      }
      return summary;
    };

    const summary7d = parseEventsSummary(events7dRows);
    const summary30d = parseEventsSummary(events30dRows);

    const rates = calculateDeliverabilityRates(
      trackerCounts.total || trackerCounts.success,
      eventCounts.delivered,
      eventCounts.opened,
      eventCounts.clicked,
      eventCounts.soft_bounce,
      eventCounts.hard_bounce,
    );

    return res.json({
      success: true,
      timeframeDays: validDays,
      overview: {
        totalDispatched: trackerCounts.total,
        totalSent: trackerCounts.success,
        failedDispatches: trackerCounts.failed,
        retriedDispatches: trackerCounts.retried,
        delivered: eventCounts.delivered,
        opened: eventCounts.opened,
        clicked: eventCounts.clicked,
        softBounced: eventCounts.soft_bounce,
        hardBounced: eventCounts.hard_bounce,
        spamComplaints: eventCounts.spam_complaint,
        totalSuppressed: parseInt(suppressionCount?.total || 0, 10),
        rates,
      },
      byProvider: providerMetrics,
      comparison: {
        last7Days: {
          tracker: tracker7d,
          events: summary7d,
          rates: calculateDeliverabilityRates(
            tracker7d.total,
            summary7d.delivered,
            summary7d.opened,
            summary7d.clicked,
            summary7d.soft_bounce,
            summary7d.hard_bounce,
          ),
        },
        last30Days: {
          tracker: tracker30d,
          events: summary30d,
          rates: calculateDeliverabilityRates(
            tracker30d.total,
            summary30d.delivered,
            summary30d.opened,
            summary30d.clicked,
            summary30d.soft_bounce,
            summary30d.hard_bounce,
          ),
        },
      },
    });
  } catch (error) {
    logger.error("Failed to fetch telemetry overview", { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /admin/api/recent-events & GET /admin/deliverability/recent-events
async function getRecentEvents(req, res) {
  try {
    const rawLimit = parseInt(req.query.limit || "50", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
    const provider = req.query.provider ? req.query.provider.toLowerCase().trim() : null;
    const eventType =
      req.query.event_type || req.query.eventType
        ? (req.query.event_type || req.query.eventType).toLowerCase().trim()
        : null;
    const email =
      req.query.email || req.query.recipient_email
        ? (req.query.email || req.query.recipient_email).toLowerCase().trim()
        : null;

    const hasEvents = await db.schema.hasTable("email_events");
    if (!hasEvents) {
      return res.json({
        success: true,
        count: 0,
        filters: { provider, event_type: eventType, email, limit },
        events: [],
      });
    }

    let query = db("email_events");
    if (provider) {
      query = query.where("provider", provider);
    }
    if (eventType) {
      query = query.where("event_type", eventType);
    }
    if (email) {
      query = query.where("recipient_email", email);
    }

    const events = await query
      .orderBy("occurred_at", "desc")
      .limit(limit)
      .select(
        "id",
        "event_id",
        "recipient_email",
        "message_id",
        "event_type",
        "provider",
        "ip_address",
        "user_agent",
        "click_url",
        "bounce_code",
        "bounce_description",
        "occurred_at",
        "created_at",
      );

    return res.json({
      success: true,
      count: events.length,
      filters: { provider, event_type: eventType, email, limit },
      events,
    });
  } catch (error) {
    logger.error("Failed to fetch recent events", { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

// POST /admin/api/retry-failed & POST /admin/deliverability/retry-failed
async function retryFailedDispatches(req, res) {
  if (isRetryingDeadLetters) {
    return res.status(429).json({
      success: false,
      error: "A dead-letter retry job is already in progress. Please wait for it to complete.",
    });
  }

  isRetryingDeadLetters = true;
  try {
    const rawHours = parseInt(req.body.hours || req.query.hours || "24", 10);
    const hours = Number.isFinite(rawHours) && rawHours > 0 ? Math.min(rawHours, 168) : 24;
    const filterEmail = req.body.email ? req.body.email.toLowerCase().trim() : null;
    const filterTemplate = req.body.templateType || null;

    const hasTracker = await db.schema.hasTable("email_tracker");
    if (!hasTracker) {
      return res.status(404).json({ success: false, error: "email_tracker table does not exist" });
    }

    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    let query = db("email_tracker")
      .where("status", "failed")
      .where("sent_at", ">=", cutoffDate)
      .orderBy("sent_at", "desc");

    if (filterEmail) {
      query = query.where("recipient_email", filterEmail);
    }
    if (filterTemplate) {
      query = query.where("template_type", filterTemplate);
    }

    const failedRecords = await query;

    if (failedRecords.length === 0) {
      return res.json({
        success: true,
        message: `No failed email dispatches found in the last ${hours} hours.`,
        timeframeHours: hours,
        summary: {
          totalFound: 0,
          uniqueRecipients: 0,
          retried: 0,
          succeeded: 0,
          failed: 0,
          skipped: 0,
        },
        results: [],
      });
    }

    // Deduplicate by recipient_email + template_type
    const uniqueRecords = new Map();
    for (const record of failedRecords) {
      const key = `${record.recipient_email}:${record.template_type}`;
      if (!uniqueRecords.has(key)) {
        uniqueRecords.set(key, record);
      }
    }

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const results = [];

    const adminSkipKey = process.env.ADMIN_SKIP_KEY || "GG!";
    const emailScheduler = require("../email-core/emailScheduler");

    for (const record of uniqueRecords.values()) {
      let userData = await sharedData.getUserByEmail(record.recipient_email);
      if (!userData) {
        userData = {
          email: record.recipient_email,
          templateType: record.template_type || "deep-work",
          routineTrack: record.template_type || "deep-work",
          timezone: "UTC",
          isActive: true,
          streakCount: 0,
        };
      } else if (record.template_type) {
        userData.templateType = record.template_type;
      }

      try {
        const sendResult = await emailScheduler.sendRoutineEmail(
          userData,
          adminSkipKey,
          process.env.RENDER_URL,
        );

        if (sendResult.status === "success") {
          succeeded++;
        } else if (sendResult.status === "failed") {
          failed++;
        } else {
          skipped++;
        }

        results.push({
          email: record.recipient_email,
          templateType: userData.templateType,
          status: sendResult.status,
          messageId: sendResult.messageId || null,
          error: sendResult.error || null,
          reason: sendResult.reason || null,
          retries: sendResult.retries !== undefined ? sendResult.retries : 0,
        });
      } catch (sendErr) {
        failed++;
        results.push({
          email: record.recipient_email,
          templateType: userData.templateType,
          status: "failed",
          error: sendErr.message,
          retries: 0,
        });
      }
    }

    logger.info(
      `🔄 Dead-letter retry batch finished: ${succeeded} succ, ${failed} fail, ${skipped} skip across ${uniqueRecords.size} records.`,
    );

    return res.json({
      success: true,
      message: `Retry completed: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped out of ${uniqueRecords.size} unique recipients.`,
      timeframeHours: hours,
      summary: {
        totalFound: failedRecords.length,
        uniqueRecipients: uniqueRecords.size,
        retried: uniqueRecords.size,
        succeeded,
        failed,
        skipped,
      },
      results,
    });
  } catch (error) {
    logger.error("Failed to retry failed dispatches", { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    isRetryingDeadLetters = false;
  }
}

// POST /admin/deliverability/unsuppress
async function unsuppressEmail(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    await suppressionService.unsuppressEmail(email, "admin");
    return res.json({
      success: true,
      message: `Email ${email} removed from suppression list and reactivated.`,
    });
  } catch (error) {
    logger.error("Failed to unsuppress email", { email, error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getDnsAudit,
  getTelemetryStats,
  getTelemetryOverview,
  getRecentEvents,
  retryFailedDispatches,
  unsuppressEmail,
};
