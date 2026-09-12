// helper/announcementService.js
const logger = require("../logger");

let inMemoryAnnouncement = null;

/**
 * Get active global broadcast announcement
 * @param {string} [track="all"]
 * @returns {Promise<Object|null>}
 */
async function getActiveAnnouncement(track = "all") {
  try {
    const redis = require("../config/redisClient");
    const raw = await redis.get("admin:announcement:active");
    if (raw) {
      const ann = JSON.parse(raw);
      if (ann.expiresAt && new Date(ann.expiresAt) < new Date()) {
        await redis.del("admin:announcement:active");
        inMemoryAnnouncement = null;
        return null;
      }
      if (ann.targetTrack === "all" || !track || ann.targetTrack === track) {
        return ann;
      }
      return null;
    }
  } catch (_err) {
    // Redis fallback
  }

  if (inMemoryAnnouncement) {
    if (inMemoryAnnouncement.expiresAt && new Date(inMemoryAnnouncement.expiresAt) < new Date()) {
      inMemoryAnnouncement = null;
      return null;
    }
    if (
      inMemoryAnnouncement.targetTrack === "all" ||
      !track ||
      inMemoryAnnouncement.targetTrack === track
    ) {
      return inMemoryAnnouncement;
    }
  }
  return null;
}

/**
 * Set active global broadcast announcement
 * @param {Object} payload - { title, message, targetTrack, priority, expiresAt }
 */
async function setAnnouncement(payload) {
  const announcement = {
    id: `ann_${Date.now()}`,
    title: String(payload.title || "Morning Routine Announcement").trim(),
    message: String(payload.message || "").trim(),
    targetTrack: payload.targetTrack || "all",
    priority: payload.priority || "normal", // normal, high, critical
    createdAt: new Date().toISOString(),
    expiresAt: payload.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  inMemoryAnnouncement = announcement;

  try {
    const redis = require("../config/redisClient");
    await redis.set("admin:announcement:active", JSON.stringify(announcement));
  } catch (_err) {
    // In-memory fallback
  }

  logger.info("📢 Global announcement published by admin", {
    id: announcement.id,
    targetTrack: announcement.targetTrack,
    priority: announcement.priority,
  });

  return announcement;
}

/**
 * Clear current active announcement
 */
async function clearAnnouncement() {
  inMemoryAnnouncement = null;
  try {
    const redis = require("../config/redisClient");
    await redis.del("admin:announcement:active");
  } catch (_err) {
    // In-memory fallback
  }
  logger.info("📢 Global announcement cleared by admin");
  return { success: true };
}

module.exports = {
  getActiveAnnouncement,
  setAnnouncement,
  clearAnnouncement,
};
