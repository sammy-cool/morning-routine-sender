// controllers/journal.controller.js
const logger = require("../logger");
const journalService = require("../helper/journalService");
const sharedData = require("../helper/shared-data");

/**
 * GET /api/journal/today
 * Loads today's entry (or specific ?date=YYYY-MM-DD) for authenticated subscriber
 */
async function getTodayJournal(req, res) {
  try {
    const email = req.subscriberEmail;
    const requestedDate = req.query.date;

    const { timezone, trackKey, date } = await journalService.getSubscriberContext(
      email,
      requestedDate,
    );

    const entry = await journalService.getEntryByDate(email, date);

    return res.json({
      success: true,
      subscriberEmail: email,
      date,
      timezone,
      track: trackKey,
      entry: entry || null,
    });
  } catch (error) {
    logger.error("Error in getTodayJournal", {
      email: req.subscriberEmail,
      error: error.message,
    });
    return res.status(500).json({ error: "Failed to load today's journal entry" });
  }
}

/**
 * POST /api/journal/save
 * Upserts today's journal entry for authenticated subscriber
 */
async function saveTodayJournal(req, res) {
  try {
    const email = req.subscriberEmail;
    const body = req.body || {};

    if (body.mood_score !== undefined && body.mood_score !== null && body.mood_score !== "") {
      const parsed = parseInt(body.mood_score, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 5) {
        return res.status(400).json({ error: "mood_score must be an integer between 1 and 5" });
      }
    }

    if (body.entry_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.entry_date)) {
      return res.status(400).json({ error: "Invalid entry_date format. Expected YYYY-MM-DD" });
    }

    const savedEntry = await journalService.saveEntry(email, body);

    return res.json({
      success: true,
      message: "Journal entry saved successfully",
      entry: savedEntry,
    });
  } catch (error) {
    logger.error("Error in saveTodayJournal", {
      email: req.subscriberEmail,
      error: error.message,
    });
    return res.status(500).json({ error: error.message || "Failed to save journal entry" });
  }
}

/**
 * GET /api/journal/history
 * Loads recent 30 entries (supports ?limit=30&offset=0)
 */
async function getJournalHistory(req, res) {
  try {
    const email = req.subscriberEmail;
    const limit = parseInt(req.query.limit, 10) || 30;
    const offset = parseInt(req.query.offset, 10) || 0;

    const entries = await journalService.getHistory(email, limit, offset);

    return res.json({
      success: true,
      count: entries.length,
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
      entries,
    });
  } catch (error) {
    logger.error("Error in getJournalHistory", {
      email: req.subscriberEmail,
      error: error.message,
    });
    return res.status(500).json({ error: "Failed to load journal history" });
  }
}

/**
 * GET /api/journal/export?format=markdown|json
 * Exports all journal entries formatted as Markdown file download or JSON
 */
async function exportJournal(req, res) {
  try {
    const email = req.subscriberEmail;
    const format = (req.query.format || "markdown").toLowerCase().trim();
    const todayStr = new Date().toISOString().split("T")[0];

    const entries = await journalService.getAllEntries(email);
    const subscriber = await sharedData.getUserByEmail(email);

    if (format === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="morning-journal-${todayStr}.json"`,
      );
      return res.json({
        subscriber: email,
        exportedAt: new Date().toISOString(),
        totalEntries: entries.length,
        entries,
      });
    }

    const md = journalService.generateMarkdownExport(email, entries, subscriber);

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="morning-journal-${todayStr}.md"`);
    return res.send(md);
  } catch (error) {
    logger.error("Error in exportJournal", {
      email: req.subscriberEmail,
      error: error.message,
    });
    return res.status(500).json({ error: "Failed to export journal entries" });
  }
}

module.exports = {
  getTodayJournal,
  saveTodayJournal,
  getJournalHistory,
  exportJournal,
};
