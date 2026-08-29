/**
 * Migration: Add multi-channel notification columns to subscribers table
 * (Discord Webhook, Telegram Bot Chat ID, and enabled channel preferences)
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasDiscord = await knex.schema.hasColumn("subscribers", "discord_webhook_url");
  if (!hasDiscord) {
    await knex.schema.alterTable("subscribers", (table) => {
      table.string("discord_webhook_url", 500).nullable();
      table.string("telegram_chat_id", 100).nullable();
      table.string("channels_enabled", 255).notNullable().defaultTo("email");
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasDiscord = await knex.schema.hasColumn("subscribers", "discord_webhook_url");
  if (hasDiscord) {
    await knex.schema.alterTable("subscribers", (table) => {
      table.dropColumn("discord_webhook_url");
      table.dropColumn("telegram_chat_id");
      table.dropColumn("channels_enabled");
    });
  }
};
