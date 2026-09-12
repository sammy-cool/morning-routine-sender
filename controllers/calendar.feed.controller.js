// controllers/calendar.feed.controller.js
const crypto = require("node:crypto");
const sharedData = require("../helper/shared-data");
const { generateIcsCalendar } = require("../helper/calendarFeedGenerator");
const logger = require("../logger");

/**
 * Generate deterministic secure token for subscriber calendar feed
 */
function getCalendarToken(email) {
  const secret =
    process.env.COOKIE_SECRET || process.env.SESSION_SECRET || "morning-routine-cal-sec";
  return crypto
    .createHmac("sha256", secret)
    .update(String(email).toLowerCase().trim())
    .digest("hex")
    .slice(0, 32);
}

/**
 * GET /api/calendar/feed/:token.ics
 * Serves live RFC 5545 iCalendar stream
 */
async function getCalendarFeed(req, res) {
  try {
    const rawParam = req.params.token || "";
    const token = rawParam.replace(/\.ics$/i, "");

    if (!token || token.length < 16) {
      return res.status(400).send("Invalid calendar token");
    }

    // Query all active subscribers or search by token
    const users = await sharedData.getUsers();
    const matchedUser = users.find((u) => {
      const expectedToken = u.calendarToken || getCalendarToken(u.email);
      return expectedToken === token;
    });

    if (!matchedUser) {
      logger.warn("Calendar feed request rejected: token not found", { token });
      return res.status(404).send("Calendar subscription not found");
    }

    const appBaseUrl =
      res.locals.apiBase ||
      `${req.protocol}://${req.get("host")}` ||
      process.env.RENDER_URL ||
      "https://morningroutine.io";

    const icsContent = generateIcsCalendar(matchedUser, appBaseUrl);

    res.set({
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="morning-routine.ics"',
      "Cache-Control": "public, max-age=3600",
    });

    return res.status(200).send(icsContent);
  } catch (error) {
    logger.error("Error serving calendar feed", { error: error.message });
    return res.status(500).send("Internal calendar error");
  }
}

module.exports = {
  getCalendarFeed,
  getCalendarToken,
};
