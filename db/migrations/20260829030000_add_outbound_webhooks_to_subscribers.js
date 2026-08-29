/**
 * Migration: Add outbound webhook columns to subscribers table
 * (webhook_endpoint_url, webhook_secret, and webhook_enabled)
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasWebhookUrl = await knex.schema.hasColumn("subscribers", "webhook_endpoint_url");
  if (!hasWebhookUrl) {
    await knex.schema.alterTable("subscribers", (table) => {
      table.string("webhook_endpoint_url", 500).nullable();
      table.string("webhook_secret", 255).nullable();
      table.boolean("webhook_enabled").notNullable().defaultTo(false);
    });
  }
};

/**
 * Rollback: Drop outbound webhook columns from subscribers table
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasWebhookUrl = await knex.schema.hasColumn("subscribers", "webhook_endpoint_url");
  if (hasWebhookUrl) {
    await knex.schema.alterTable("subscribers", (table) => {
      table.dropColumn("webhook_endpoint_url");
      table.dropColumn("webhook_secret");
      table.dropColumn("webhook_enabled");
    });
  }
};
