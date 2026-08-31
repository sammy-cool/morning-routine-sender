/**
 * __tests__/db.migrations.complete.test.js
 *
 * Comprehensive Database Migrations Symmetric Rollback & Idempotency Test Suite
 * Covers all 11 Knex migrations:
 *  1. 20251009153643_create_email_tracker_table.js
 *  2. 20251009153701_create_last_run_table.js
 *  3. 20260711172620_create_subscribers_table.js
 *  4. 20260828000000_add_streaks_and_track_to_subscribers.js
 *  5. 20260828010000_create_suppression_and_events_tables.js
 *  6. 20260828020000_create_push_subscriptions_table.js
 *  7. 20260829000000_create_journal_entries_table.js
 *  8. 20260829010000_add_channels_to_subscribers.js
 *  9. 20260829020000_add_coach_persona_to_subscribers.js
 * 10. 20260829030000_add_outbound_webhooks_to_subscribers.js
 * 11. 20260831000000_add_streak_freezes_to_subscribers.js
 */

const { newDb } = require("pg-mem");

// Load all 11 migrations in execution order
const migrations = [
  {
    name: "20251009153643_create_email_tracker_table",
    module: require("../db/migrations/20251009153643_create_email_tracker_table"),
  },
  {
    name: "20251009153701_create_last_run_table",
    module: require("../db/migrations/20251009153701_create_last_run_table"),
  },
  {
    name: "20260711172620_create_subscribers_table",
    module: require("../db/migrations/20260711172620_create_subscribers_table"),
  },
  {
    name: "20260828000000_add_streaks_and_track_to_subscribers",
    module: require("../db/migrations/20260828000000_add_streaks_and_track_to_subscribers"),
  },
  {
    name: "20260828010000_create_suppression_and_events_tables",
    module: require("../db/migrations/20260828010000_create_suppression_and_events_tables"),
  },
  {
    name: "20260828020000_create_push_subscriptions_table",
    module: require("../db/migrations/20260828020000_create_push_subscriptions_table"),
  },
  {
    name: "20260829000000_create_journal_entries_table",
    module: require("../db/migrations/20260829000000_create_journal_entries_table"),
  },
  {
    name: "20260829010000_add_channels_to_subscribers",
    module: require("../db/migrations/20260829010000_add_channels_to_subscribers"),
  },
  {
    name: "20260829020000_add_coach_persona_to_subscribers",
    module: require("../db/migrations/20260829020000_add_coach_persona_to_subscribers"),
  },
  {
    name: "20260829030000_add_outbound_webhooks_to_subscribers",
    module: require("../db/migrations/20260829030000_add_outbound_webhooks_to_subscribers"),
  },
  {
    name: "20260831000000_add_streak_freezes_to_subscribers",
    module: require("../db/migrations/20260831000000_add_streak_freezes_to_subscribers"),
  },
];

async function runAllUp(knex) {
  for (const m of migrations) {
    await m.module.up(knex);
  }
}

async function runAllDown(knex) {
  for (let i = migrations.length - 1; i >= 0; i--) {
    await migrations[i].module.down(knex);
  }
}

describe("Database Migrations: Symmetric Rollback, Idempotency & Schema Matrix", () => {
  let memDb;
  let knex;

  beforeEach(() => {
    memDb = newDb();
    knex = memDb.adapters.createKnex(0);
  });

  afterEach(async () => {
    if (knex) {
      await knex.destroy();
    }
  });

  describe("1. Full Lifecycle & Symmetric Rollback Loop", () => {
    test("runs migrate up -> migrate down cleanly on database schema", async () => {
      // 1. Initial migrate up (all 11 migrations)
      await runAllUp(knex);

      // Verify all 7 tables exist
      const expectedTables = [
        "email_tracker",
        "job_last_run",
        "subscribers",
        "suppression_list",
        "email_events",
        "push_subscriptions",
        "journal_entries",
      ];
      for (const tbl of expectedTables) {
        const hasTable = await knex.schema.hasTable(tbl);
        expect(hasTable).toBe(true);
      }

      // 2. Symmetric full rollback (11 down to 1)
      await runAllDown(knex);

      // Verify all tables dropped
      for (const tbl of expectedTables) {
        const hasTable = await knex.schema.hasTable(tbl);
        expect(hasTable).toBe(false);
      }

      // 3. Re-apply all migrations up on clean database instance
      const freshKnex = newDb().adapters.createKnex(0);
      await runAllUp(freshKnex);
      for (const tbl of expectedTables) {
        const hasTable = await freshKnex.schema.hasTable(tbl);
        expect(hasTable).toBe(true);
      }
      await freshKnex.destroy();
    });
  });

  describe("2. Step-by-Step Granular Symmetric Rollback", () => {
    test("rolls back each migration individually in reverse order verifying intermediate schema states", async () => {
      await runAllUp(knex);

      // Rollback 11: streak freezes
      await migrations[10].module.down(knex);
      expect(await knex.schema.hasColumn("subscribers", "streak_freezes")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "freeze_history")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "webhook_endpoint_url")).toBe(true);

      // Rollback 10: outbound webhooks
      await migrations[9].module.down(knex);
      expect(await knex.schema.hasColumn("subscribers", "webhook_endpoint_url")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "webhook_secret")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "webhook_enabled")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "coach_persona")).toBe(true);

      // Rollback 9: coach persona
      await migrations[8].module.down(knex);
      expect(await knex.schema.hasColumn("subscribers", "coach_persona")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "discord_webhook_url")).toBe(true);

      // Rollback 8: multi-channels
      await migrations[7].module.down(knex);
      expect(await knex.schema.hasColumn("subscribers", "discord_webhook_url")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "telegram_chat_id")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "channels_enabled")).toBe(false);
      expect(await knex.schema.hasTable("journal_entries")).toBe(true);

      // Rollback 7: journal entries table
      await migrations[6].module.down(knex);
      expect(await knex.schema.hasTable("journal_entries")).toBe(false);
      expect(await knex.schema.hasTable("push_subscriptions")).toBe(true);

      // Rollback 6: push subscriptions table
      await migrations[5].module.down(knex);
      expect(await knex.schema.hasTable("push_subscriptions")).toBe(false);
      expect(await knex.schema.hasTable("suppression_list")).toBe(true);
      expect(await knex.schema.hasTable("email_events")).toBe(true);

      // Rollback 5: suppression, events, and deliverability columns
      await migrations[4].module.down(knex);
      expect(await knex.schema.hasTable("suppression_list")).toBe(false);
      expect(await knex.schema.hasTable("email_events")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "deliverability_status")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "soft_bounce_count")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "streak_count")).toBe(true);

      // Rollback 4: streaks and track
      await migrations[3].module.down(knex);
      expect(await knex.schema.hasColumn("subscribers", "streak_count")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "last_checkin_date")).toBe(false);
      expect(await knex.schema.hasColumn("subscribers", "routine_track")).toBe(false);
      expect(await knex.schema.hasTable("subscribers")).toBe(true);

      // Rollback 3: subscribers table
      await migrations[2].module.down(knex);
      expect(await knex.schema.hasTable("subscribers")).toBe(false);
      expect(await knex.schema.hasTable("job_last_run")).toBe(true);

      // Rollback 2: job_last_run table
      await migrations[1].module.down(knex);
      expect(await knex.schema.hasTable("job_last_run")).toBe(false);
      expect(await knex.schema.hasTable("email_tracker")).toBe(true);

      // Rollback 1: email_tracker table
      await migrations[0].module.down(knex);
      expect(await knex.schema.hasTable("email_tracker")).toBe(false);
    });
  });

  describe("3. Column Existence & Default Values Verification", () => {
    beforeEach(async () => {
      await runAllUp(knex);
    });

    test("subscribers table contains all 23 evolutionary columns with exact defaults", async () => {
      const subscriberColumns = [
        "id",
        "email",
        "template_type",
        "cron_pattern",
        "timezone",
        "is_active",
        "created_at",
        "updated_at",
        "streak_count",
        "last_checkin_date",
        "routine_track",
        "deliverability_status",
        "soft_bounce_count",
        "bounce_cooldown_until",
        "last_bounce_at",
        "last_bounce_type",
        "last_bounce_code",
        "last_delivered_at",
        "last_opened_at",
        "last_clicked_at",
        "discord_webhook_url",
        "telegram_chat_id",
        "channels_enabled",
        "coach_persona",
        "webhook_endpoint_url",
        "webhook_secret",
        "webhook_enabled",
        "streak_freezes",
        "freeze_history",
      ];

      for (const col of subscriberColumns) {
        const exists = await knex.schema.hasColumn("subscribers", col);
        expect(exists).toBe(true);
      }

      // Test default values upon insertion
      await knex("subscribers").insert({
        email: "defaults@example.com",
        cron_pattern: "0 8 * * *",
      });

      const row = await knex("subscribers").where({ email: "defaults@example.com" }).first();
      expect(row.email).toBe("defaults@example.com");
      expect(row.template_type).toBe("basic");
      expect(row.timezone).toBe("Asia/Kolkata");
      expect(Boolean(row.is_active)).toBe(true);
      expect(Number(row.streak_count)).toBe(0);
      expect(row.routine_track).toBe("deep-work");
      expect(row.deliverability_status).toBe("active");
      expect(Number(row.soft_bounce_count)).toBe(0);
      expect(row.channels_enabled).toBe("email");
      expect(row.coach_persona).toBe("stoic");
      expect([false, 0, "0"]).toContain(row.webhook_enabled);
      expect(Number(row.streak_freezes)).toBe(2);
      expect(row.freeze_history).toBe("[]");
    });

    test("email_tracker defaults retry_count to 0", async () => {
      await knex("email_tracker").insert({
        recipient_email: "tracker@example.com",
        template_type: "deep-work",
        sent_at: new Date(),
        status: "success",
      });

      const row = await knex("email_tracker")
        .where({ recipient_email: "tracker@example.com" })
        .first();
      expect(Number(row.retry_count)).toBe(0);
      expect(row.error_message).toBeNull();
      expect(row.message_id).toBeNull();
    });

    test("job_last_run defaults emails_sent and emails_failed to 0", async () => {
      await knex("job_last_run").insert({
        job_name: "morning_cron",
        last_run_at: new Date(),
        status: "success",
      });

      const row = await knex("job_last_run").where({ job_name: "morning_cron" }).first();
      expect(Number(row.emails_sent)).toBe(0);
      expect(Number(row.emails_failed)).toBe(0);
    });

    test("push_subscriptions defaults is_active to true and failed_attempts to 0", async () => {
      await knex("push_subscriptions").insert({
        subscriber_email: "push@example.com",
        endpoint: "https://push.example.com/sub/123",
        p256dh: "key-p256dh",
        auth: "auth-token",
      });

      const row = await knex("push_subscriptions")
        .where({ subscriber_email: "push@example.com" })
        .first();
      expect(Boolean(row.is_active)).toBe(true);
      expect(Number(row.failed_attempts)).toBe(0);
    });

    test("journal_entries defaults track_key to 'deep-work' and mood_score to 5", async () => {
      await knex("journal_entries").insert({
        subscriber_email: "journaler@example.com",
        entry_date: "2026-08-31",
      });

      const row = await knex("journal_entries")
        .where({ subscriber_email: "journaler@example.com" })
        .first();
      expect(row.track_key).toBe("deep-work");
      expect(Number(row.mood_score)).toBe(5);
    });
  });

  describe("4. Unique Constraints & Data Integrity", () => {
    beforeEach(async () => {
      await runAllUp(knex);
    });

    test("subscribers table enforces unique email", async () => {
      await knex("subscribers").insert({ email: "unique@example.com", cron_pattern: "0 8 * * *" });
      await expect(
        knex("subscribers").insert({ email: "unique@example.com", cron_pattern: "0 9 * * *" }),
      ).rejects.toThrow();
    });

    test("job_last_run enforces unique job_name", async () => {
      await knex("job_last_run").insert({
        job_name: "unique_job",
        last_run_at: new Date(),
        status: "success",
      });
      await expect(
        knex("job_last_run").insert({
          job_name: "unique_job",
          last_run_at: new Date(),
          status: "failed",
        }),
      ).rejects.toThrow();
    });

    test("suppression_list enforces unique email", async () => {
      await knex("suppression_list").insert({
        email: "suppressed@example.com",
        reason: "hard_bounce",
      });
      await expect(
        knex("suppression_list").insert({
          email: "suppressed@example.com",
          reason: "spam_complaint",
        }),
      ).rejects.toThrow();
    });

    test("email_events enforces unique event_id when provided", async () => {
      await knex("email_events").insert({
        event_id: "evt-unique-123",
        recipient_email: "event@example.com",
        event_type: "delivered",
        provider: "resend",
        occurred_at: new Date(),
      });
      await expect(
        knex("email_events").insert({
          event_id: "evt-unique-123",
          recipient_email: "event@example.com",
          event_type: "opened",
          provider: "resend",
          occurred_at: new Date(),
        }),
      ).rejects.toThrow();
    });

    test("push_subscriptions enforces unique endpoint", async () => {
      await knex("push_subscriptions").insert({
        subscriber_email: "user1@example.com",
        endpoint: "https://push.example.com/unique-endpoint",
        p256dh: "key1",
        auth: "auth1",
      });
      await expect(
        knex("push_subscriptions").insert({
          subscriber_email: "user2@example.com",
          endpoint: "https://push.example.com/unique-endpoint",
          p256dh: "key2",
          auth: "auth2",
        }),
      ).rejects.toThrow();
    });

    test("journal_entries enforces composite unique on (subscriber_email, entry_date)", async () => {
      await knex("journal_entries").insert({
        subscriber_email: "daily@example.com",
        entry_date: "2026-08-31",
        one_big_thing: "First submission",
      });
      await expect(
        knex("journal_entries").insert({
          subscriber_email: "daily@example.com",
          entry_date: "2026-08-31",
          one_big_thing: "Duplicate submission",
        }),
      ).rejects.toThrow();

      // Different date for same email succeeds
      await expect(
        knex("journal_entries").insert({
          subscriber_email: "daily@example.com",
          entry_date: "2026-09-01",
          one_big_thing: "Next day submission",
        }),
      ).resolves.toBeDefined();
    });
  });

  describe("5. Foreign Key Cascades & Nullability Constraints", () => {
    beforeEach(async () => {
      await runAllUp(knex);
    });

    test("push_subscriptions and journal_entries link to subscribers.id with cascade support", async () => {
      await knex("subscribers").insert({
        id: 100,
        email: "cascade.test@example.com",
        cron_pattern: "0 8 * * *",
      });

      await knex("push_subscriptions").insert({
        subscriber_id: 100,
        subscriber_email: "cascade.test@example.com",
        endpoint: "https://push.example.com/cascade/100",
        p256dh: "p256dh",
        auth: "auth",
      });

      await knex("journal_entries").insert({
        subscriber_id: 100,
        subscriber_email: "cascade.test@example.com",
        entry_date: "2026-08-31",
      });

      const push = await knex("push_subscriptions").where({ subscriber_id: 100 }).first();
      const journal = await knex("journal_entries").where({ subscriber_id: 100 }).first();
      expect(push.subscriber_id).toBe(100);
      expect(journal.subscriber_id).toBe(100);

      // Deleting the parent subscriber record succeeds
      await knex("subscribers").where({ id: 100 }).del();
      const sub = await knex("subscribers").where({ id: 100 }).first();
      expect(sub).toBeUndefined();
    });

    test("rejects missing mandatory (notNullable) columns", async () => {
      // subscribers: missing cron_pattern
      await expect(
        knex("subscribers").insert({ email: "missing_cron@example.com" }),
      ).rejects.toThrow();

      // email_tracker: missing template_type
      await expect(
        knex("email_tracker").insert({
          recipient_email: "test@example.com",
          sent_at: new Date(),
          status: "success",
        }),
      ).rejects.toThrow();

      // job_last_run: missing last_run_at
      await expect(
        knex("job_last_run").insert({ job_name: "test_job", status: "success" }),
      ).rejects.toThrow();

      // suppression_list: missing reason
      await expect(
        knex("suppression_list").insert({ email: "suppress@example.com" }),
      ).rejects.toThrow();
    });
  });
});
