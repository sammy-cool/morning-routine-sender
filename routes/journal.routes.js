// routes/journal.routes.js
const express = require("express");
const router = express.Router();
const { requireSubscriberAuth } = require("../middleware/subscriberSession");
const journalController = require("../controllers/journal.controller");

// Daily Morning Reflection & Journaling API
router.get("/api/journal/today", requireSubscriberAuth, journalController.getTodayJournal);
router.post("/api/journal/save", requireSubscriberAuth, journalController.saveTodayJournal);
router.get("/api/journal/history", requireSubscriberAuth, journalController.getJournalHistory);
router.get("/api/journal/heatmap", requireSubscriberAuth, journalController.getJournalHeatmap);
router.get("/api/journal/export", requireSubscriberAuth, journalController.exportJournal);

module.exports = router;
