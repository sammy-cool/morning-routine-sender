const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.cwd();
const TRACK_DIR = path.join(ROOT_DIR, "storage");
const TRACK_FILE = path.join(TRACK_DIR, "email-tracker.json");

// ✅ Ensure the folder exists before saving the file
function ensureStorageDirExists() {
  if (!fs.existsSync(TRACK_DIR)) {
    fs.mkdirSync(TRACK_DIR, { recursive: true });
    console.log("Created tracker storage folder:", TRACK_DIR);
  }
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function loadTracker() {
  try {
    if (!fs.existsSync(TRACK_FILE)) return {};
    const data = fs.readFileSync(TRACK_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to load tracker:", err);
    return {};
  }
}

function saveTracker(tracker) {
  try {
    ensureStorageDirExists();
    fs.writeFileSync(TRACK_FILE, JSON.stringify(tracker, null, 2));
  } catch (err) {
    console.error("Failed to save tracker:", err);
  }
}

function shouldSendEmail(userEmail, type) {
  const tracker = loadTracker();
  const key = `${type}:${userEmail}`;
  const record = tracker[key];
  const today = getTodayDate();

  // Send if never sent today successfully
  return !record || record.date !== today || record.status !== "success";
}

function updateTracker(userEmail, type, status, error = null) {
  const tracker = loadTracker();
  const key = `${type}:${userEmail}`;

  tracker[key] = {
    date: getTodayDate(),
    status,
    error,
  };

  saveTracker(tracker);
  console.log(`Tracker updated for ${key}: ${status}`);
}

function cleanupOldEntries(days = 7) {
  const tracker = loadTracker();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  let removedCount = 0;

  for (const [key, record] of Object.entries(tracker)) {
    const recordDate = new Date(record.date);
    if (recordDate < cutoff) {
      delete tracker[key];
      removedCount++;
    }
  }

  saveTracker(tracker);
  console.log(`Cleaned up ${removedCount} old entries from tracker.`);
}

module.exports = {
  shouldSendEmail,
  updateTracker,
  cleanupOldEntries,
};
