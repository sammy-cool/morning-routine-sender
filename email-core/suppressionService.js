// email-core/suppressionService.js
const db = require("../db/knex");
const logger = require("../logger");

const MAX_CONSECUTIVE_SOFT_BOUNCES = 3;
const SOFT_BOUNCE_COOLDOWN_HOURS = [4, 24, 72];

class SuppressionService {
  /**
   * Checks if an email is suppressed or in soft bounce cooldown
   * @param {string} email
   * @returns {Promise<{ isSuppressed: boolean, reason?: string, cooldownUntil?: Date, details?: string }>}
   */
  async checkPreSendEligibility(email) {
    email = (email || "").toLowerCase().trim();
    if (!email) return { isSuppressed: true, reason: "invalid_email" };

    try {
      // 1. Check permanent suppression list (if table exists)
      const hasSuppression = await db.schema.hasTable("suppression_list");
      if (hasSuppression) {
        const suppressed = await db("suppression_list")
          .where("email", email)
          .where((builder) => {
            builder.whereNull("expires_at").orWhere("expires_at", ">", db.fn.now());
          })
          .first();

        if (suppressed) {
          return {
            isSuppressed: true,
            reason: `suppression_list:${suppressed.reason}`,
            details: suppressed.diagnostic_reason,
          };
        }
      }

      // 2. Check subscriber cooldown status
      const subscriber = await db("subscribers")
        .where("email", email)
        .first();

      if (!subscriber) {
        return { isSuppressed: false };
      }

      if (!subscriber.is_active || subscriber.deliverability_status === "bounced" || subscriber.deliverability_status === "complained") {
        return {
          isSuppressed: true,
          reason: `subscriber_inactive_or_${subscriber.deliverability_status || "disabled"}`,
        };
      }

      if (subscriber.bounce_cooldown_until && new Date(subscriber.bounce_cooldown_until) > new Date()) {
        return {
          isSuppressed: true,
          reason: "soft_bounce_cooldown",
          cooldownUntil: new Date(subscriber.bounce_cooldown_until),
        };
      }

      return { isSuppressed: false };
    } catch (err) {
      logger.warn("Pre-send eligibility check soft warning:", err.message);
      return { isSuppressed: false };
    }
  }

  /**
   * Process a telemetry event and apply list hygiene state transitions
   * @param {Object} event - Standardized EmailTelemetryEvent
   */
  async processTelemetryEvent(event) {
    const {
      eventId,
      recipientEmail,
      messageId,
      eventType,
      provider,
      ipAddress,
      userAgent,
      clickUrl,
      bounceCode,
      bounceDescription,
      occurredAt,
      rawPayload,
    } = event;

    const email = (recipientEmail || "").toLowerCase().trim();
    if (!email) return;

    try {
      // 1. Insert into email_events if table exists
      const hasEvents = await db.schema.hasTable("email_events");
      if (hasEvents) {
        await db("email_events")
          .insert({
            event_id: eventId,
            recipient_email: email,
            message_id: messageId,
            event_type: eventType,
            provider: provider || "generic",
            ip_address: ipAddress,
            user_agent: userAgent,
            click_url: clickUrl,
            bounce_code: bounceCode,
            bounce_description: bounceDescription,
            raw_payload: rawPayload ? JSON.stringify(rawPayload) : null,
            occurred_at: occurredAt || new Date(),
          })
          .onConflict("event_id")
          .ignore();
      }

      // 2. State transition based on event type
      switch (eventType) {
        case "hard_bounce":
          await this.handleHardBounce(email, provider, bounceCode, bounceDescription);
          break;

        case "soft_bounce":
          await this.handleSoftBounce(email, provider, bounceCode, bounceDescription);
          break;

        case "spam_complaint":
          await this.handleSpamComplaint(email, provider, bounceDescription);
          break;

        case "delivered":
          await this.handleDelivered(email);
          break;

        case "opened":
        case "clicked":
          await this.handleEngagement(email, eventType);
          break;

        case "unsubscribed":
          await this.handleUnsubscribe(email, provider);
          break;
      }
    } catch (err) {
      logger.error("Failed to process telemetry event", {
        email,
        eventType,
        error: err.message,
      });
      throw err;
    }
  }

  async handleHardBounce(email, provider, bounceCode, reason) {
    logger.warn(`🛑 Processing Hard Bounce for ${email}`, { bounceCode, reason });

    const subscriberPatch = {
      is_active: false,
      updated_at: db.fn.now(),
    };
    const hasStatus = await db.schema.hasColumn("subscribers", "deliverability_status");
    if (hasStatus) {
      subscriberPatch.deliverability_status = "bounced";
      subscriberPatch.last_bounce_at = db.fn.now();
      subscriberPatch.last_bounce_type = "hard";
      subscriberPatch.last_bounce_code = bounceCode || "5.1.1";
    }

    await db("subscribers").where("email", email).update(subscriberPatch);

    const hasSuppression = await db.schema.hasTable("suppression_list");
    if (hasSuppression) {
      await db("suppression_list")
        .insert({
          email,
          reason: "hard_bounce",
          provider,
          bounce_code: bounceCode || "5.1.1",
          diagnostic_reason: reason || "Permanent delivery failure (Hard Bounce)",
          suppressed_at: db.fn.now(),
        })
        .onConflict("email")
        .merge({
          reason: "hard_bounce",
          provider,
          bounce_code: bounceCode || "5.1.1",
          diagnostic_reason: reason || "Permanent delivery failure (Hard Bounce)",
          suppressed_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
    }

    await db("email_tracker")
      .where("recipient_email", email)
      .orderBy("sent_at", "desc")
      .limit(1)
      .update({
        status: "bounced",
        error_message: `Hard Bounce: ${reason || bounceCode || "Unknown"}`,
        updated_at: db.fn.now(),
      });
  }

  async handleSoftBounce(email, provider, bounceCode, reason) {
    const subscriber = await db("subscribers").where("email", email).first();
    const currentCount = (subscriber?.soft_bounce_count || 0) + 1;

    logger.warn(`⚠️ Processing Soft Bounce for ${email} (Count: ${currentCount}/${MAX_CONSECUTIVE_SOFT_BOUNCES})`, {
      bounceCode,
      reason,
    });

    if (currentCount >= MAX_CONSECUTIVE_SOFT_BOUNCES) {
      await this.handleHardBounce(
        email,
        provider,
        bounceCode || "4.2.2_ESCALATED",
        `Exceeded ${MAX_CONSECUTIVE_SOFT_BOUNCES} consecutive soft bounces: ${reason || "Mailbox unavailable"}`
      );
      return;
    }

    const cooldownIdx = Math.min(currentCount - 1, SOFT_BOUNCE_COOLDOWN_HOURS.length - 1);
    const cooldownHours = SOFT_BOUNCE_COOLDOWN_HOURS[cooldownIdx];
    const cooldownUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000);

    const patch = { updated_at: db.fn.now() };
    const hasStatus = await db.schema.hasColumn("subscribers", "deliverability_status");
    if (hasStatus) {
      patch.soft_bounce_count = currentCount;
      patch.deliverability_status = "soft_bounce_cooldown";
      patch.bounce_cooldown_until = cooldownUntil;
      patch.last_bounce_at = db.fn.now();
      patch.last_bounce_type = "soft";
      patch.last_bounce_code = bounceCode || "4.0.0";
    }

    await db("subscribers").where("email", email).update(patch);
  }

  async handleSpamComplaint(email, provider, reason) {
    logger.error(`🚨 Spam Complaint Received for ${email}`, { provider, reason });

    const patch = { is_active: false, updated_at: db.fn.now() };
    const hasStatus = await db.schema.hasColumn("subscribers", "deliverability_status");
    if (hasStatus) {
      patch.deliverability_status = "complained";
    }
    await db("subscribers").where("email", email).update(patch);

    const hasSuppression = await db.schema.hasTable("suppression_list");
    if (hasSuppression) {
      await db("suppression_list")
        .insert({
          email,
          reason: "spam_complaint",
          provider,
          diagnostic_reason: reason || "User marked email as spam / FBL report",
          suppressed_at: db.fn.now(),
        })
        .onConflict("email")
        .merge({
          reason: "spam_complaint",
          provider,
          diagnostic_reason: reason || "User marked email as spam / FBL report",
          suppressed_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
    }
  }

  async handleDelivered(email) {
    const hasStatus = await db.schema.hasColumn("subscribers", "deliverability_status");
    if (hasStatus) {
      await db("subscribers")
        .where("email", email)
        .update({
          soft_bounce_count: 0,
          bounce_cooldown_until: null,
          deliverability_status: "active",
          last_delivered_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
    }
  }

  async handleEngagement(email, eventType) {
    const hasStatus = await db.schema.hasColumn("subscribers", "deliverability_status");
    if (hasStatus) {
      const patch = {
        soft_bounce_count: 0,
        bounce_cooldown_until: null,
        deliverability_status: "active",
        updated_at: db.fn.now(),
      };
      if (eventType === "opened") patch.last_opened_at = db.fn.now();
      if (eventType === "clicked") patch.last_clicked_at = db.fn.now();
      await db("subscribers").where("email", email).update(patch);
    }
  }

  async handleUnsubscribe(email, provider) {
    const hasStatus = await db.schema.hasColumn("subscribers", "deliverability_status");
    const patch = { is_active: false, updated_at: db.fn.now() };
    if (hasStatus) patch.deliverability_status = "suppressed";
    await db("subscribers").where("email", email).update(patch);

    const hasSuppression = await db.schema.hasTable("suppression_list");
    if (hasSuppression) {
      await db("suppression_list")
        .insert({
          email,
          reason: "unsubscribe",
          provider,
          diagnostic_reason: "1-click unsubscribe webhook",
          suppressed_at: db.fn.now(),
        })
        .onConflict("email")
        .ignore();
    }
  }

  async unsuppressEmail(email, adminUser = "admin") {
    email = (email || "").toLowerCase().trim();
    const hasSuppression = await db.schema.hasTable("suppression_list");
    if (hasSuppression) {
      await db("suppression_list").where("email", email).del();
    }

    const patch = { is_active: true, updated_at: db.fn.now() };
    const hasStatus = await db.schema.hasColumn("subscribers", "deliverability_status");
    if (hasStatus) {
      patch.deliverability_status = "active";
      patch.soft_bounce_count = 0;
      patch.bounce_cooldown_until = null;
    }
    await db("subscribers").where("email", email).update(patch);

    logger.info(`🔓 Subscriber unsuppressed by ${adminUser}: ${email}`);
    return { success: true, email };
  }
}

module.exports = new SuppressionService();
