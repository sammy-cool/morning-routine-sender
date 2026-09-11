// controllers/squad.controller.js
const crypto = require("crypto");
const db = require("../db/knex");
const sharedData = require("../helper/shared-data");
const logger = require("../logger");

/**
 * Helper to extract authenticated subscriber email
 */
function getSubscriberEmail(req) {
  return (
    req.subscriber?.email ||
    req.subscriberEmail ||
    req.user?.email ||
    (typeof req.query?.email === "string" ? req.query.email : null) ||
    (typeof req.body?.email === "string" ? req.body.email : null) ||
    ""
  )
    .trim()
    .toLowerCase();
}

/**
 * Generate a clean, human-friendly 8-character squad invite code
 * Format: SQUAD-XXXX (e.g. SQUAD-A7B9)
 */
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomStr = "";
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) {
    randomStr += chars[bytes[i] % chars.length];
  }
  return `SQUAD-${randomStr}`;
}

/**
 * POST /api/me/squad/create
 * Create a new accountability squad
 */
async function createSquad(req, res) {
  const email = getSubscriberEmail(req);
  if (!email) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  const name = (req.body?.name || "").trim();
  if (!name || name.length < 2 || name.length > 60) {
    return res.status(400).json({
      success: false,
      error: "Squad name must be between 2 and 60 characters",
    });
  }

  try {
    // Check if user is already in an active squad
    const existingMembership = await db("squad_members").where("subscriber_email", email).first();

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        error: "You are already a member of a squad. Please leave your current squad first.",
      });
    }

    let inviteCode = generateInviteCode();
    // Ensure uniqueness
    let collision = await db("accountability_squads").where("invite_code", inviteCode).first();
    while (collision) {
      inviteCode = generateInviteCode();
      collision = await db("accountability_squads").where("invite_code", inviteCode).first();
    }

    const subscriber = await sharedData.getUserByEmail(email);
    const initialStreak = subscriber ? Number(subscriber.streakCount) || 0 : 0;

    let squadId;
    await db.transaction(async (trx) => {
      const [inserted] = await trx("accountability_squads")
        .insert({
          name,
          invite_code: inviteCode,
          creator_email: email,
          max_members: 5,
          squad_streak: initialStreak > 0 ? 1 : 0,
        })
        .returning("id");

      squadId = typeof inserted === "object" && inserted !== null ? inserted.id : inserted;

      await trx("squad_members").insert({
        squad_id: squadId,
        subscriber_email: email,
        role: "leader",
      });
    });

    logger.info("👥 Accountability Squad created", { email, squadId, name, inviteCode });

    return res.status(201).json({
      success: true,
      message: "Squad created successfully!",
      squad: {
        id: squadId,
        name,
        inviteCode,
        creatorEmail: email,
        role: "leader",
      },
    });
  } catch (err) {
    logger.error("Error creating accountability squad", { error: err.message, email });
    return res.status(500).json({
      success: false,
      error: "Unable to create squad. Please try again later.",
    });
  }
}

/**
 * POST /api/me/squad/join
 * Join an existing squad using an invite code
 */
async function joinSquad(req, res) {
  const email = getSubscriberEmail(req);
  if (!email) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  let code = (req.body?.invite_code || req.body?.inviteCode || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ success: false, error: "Invite code is required" });
  }
  if (!code.startsWith("SQUAD-")) {
    code = `SQUAD-${code}`;
  }

  try {
    // Check if user is already in a squad
    const existingMembership = await db("squad_members").where("subscriber_email", email).first();

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        error:
          "You are already a member of an active squad. Please leave your current squad first.",
      });
    }

    const squad = await db("accountability_squads").where("invite_code", code).first();

    if (!squad) {
      return res.status(404).json({
        success: false,
        error: "Invalid invite code. No matching squad found.",
      });
    }

    const currentMembers = await db("squad_members").where("squad_id", squad.id);
    if (currentMembers.length >= squad.max_members) {
      return res.status(400).json({
        success: false,
        error: `Squad is full! Maximum capacity is ${squad.max_members} members.`,
      });
    }

    await db("squad_members").insert({
      squad_id: squad.id,
      subscriber_email: email,
      role: "member",
    });

    logger.info("👥 Joined accountability squad", { email, squadId: squad.id, code });

    return res.json({
      success: true,
      message: `Successfully joined ${squad.name}!`,
      squad: {
        id: squad.id,
        name: squad.name,
        inviteCode: squad.invite_code,
        role: "member",
      },
    });
  } catch (err) {
    logger.error("Error joining squad", { error: err.message, email });
    return res.status(500).json({
      success: false,
      error: "Unable to join squad. Please try again.",
    });
  }
}

/**
 * GET /api/me/squad
 * Retrieve current subscriber's squad and member status
 */
async function getSquad(req, res) {
  const email = getSubscriberEmail(req);
  if (!email) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  try {
    const membership = await db("squad_members").where("subscriber_email", email).first();

    if (!membership) {
      return res.json({
        success: true,
        inSquad: false,
        squad: null,
      });
    }

    const squad = await db("accountability_squads").where("id", membership.squad_id).first();

    if (!squad) {
      return res.json({
        success: true,
        inSquad: false,
        squad: null,
      });
    }

    const membersRecords = await db("squad_members")
      .where("squad_id", squad.id)
      .orderBy("joined_at", "asc");

    const todayDate = new Intl.DateTimeFormat("en-CA").format(new Date());

    // Enrich members with their live streak counts and check-in status
    const enrichedMembers = await Promise.all(
      membersRecords.map(async (m) => {
        const sub = await sharedData.getUserByEmail(m.subscriber_email);
        const streak = sub ? Number(sub.streakCount) || 0 : 0;
        const lastCheckin = sub?.lastCheckinDate || null;
        const checkedInToday = lastCheckin === todayDate;
        const displayName = m.subscriber_email.split("@")[0];

        return {
          email: m.subscriber_email,
          displayName,
          role: m.role,
          streak,
          track: sub?.routineTrack || "deep-work",
          checkedInToday,
          isCurrentUser: m.subscriber_email === email,
          joinedAt: m.joined_at,
        };
      }),
    );

    const todayCompletedCount = enrichedMembers.filter((m) => m.checkedInToday).length;
    const allCheckedInToday =
      enrichedMembers.length > 0 && todayCompletedCount === enrichedMembers.length;

    // Calculate aggregated squad streak: min streak among members
    const streaks = enrichedMembers.map((m) => m.streak);
    const aggregateStreak = streaks.length > 0 ? Math.min(...streaks) : 0;

    return res.json({
      success: true,
      inSquad: true,
      squad: {
        id: squad.id,
        name: squad.name,
        inviteCode: squad.invite_code,
        creatorEmail: squad.creator_email,
        maxMembers: squad.max_members,
        squadStreak: aggregateStreak,
        userRole: membership.role,
      },
      stats: {
        totalMembers: enrichedMembers.length,
        todayCompletedCount,
        allCheckedInToday,
      },
      members: enrichedMembers,
    });
  } catch (err) {
    logger.error("Error fetching squad info", { error: err.message, email });
    return res.status(500).json({
      success: false,
      error: "Failed to fetch squad details",
    });
  }
}

/**
 * POST /api/me/squad/leave
 * Leave current squad
 */
async function leaveSquad(req, res) {
  const email = getSubscriberEmail(req);
  if (!email) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  try {
    const membership = await db("squad_members").where("subscriber_email", email).first();

    if (!membership) {
      return res.status(400).json({ success: false, error: "You are not in any squad" });
    }

    const squadId = membership.squad_id;

    await db("squad_members").where({ squad_id: squadId, subscriber_email: email }).del();

    const remainingMembers = await db("squad_members").where("squad_id", squadId);

    if (remainingMembers.length === 0) {
      // Clean up empty squad
      await db("accountability_squads").where("id", squadId).del();
      logger.info("👥 Dissolved empty squad", { squadId });
    } else if (membership.role === "leader") {
      // Promote next member to leader
      await db("squad_members").where("id", remainingMembers[0].id).update({ role: "leader" });
      logger.info("👥 Promoted new squad leader", {
        squadId,
        newLeader: remainingMembers[0].subscriber_email,
      });
    }

    logger.info("👥 Subscriber left squad", { email, squadId });

    return res.json({
      success: true,
      message: "You have left the squad.",
    });
  } catch (err) {
    logger.error("Error leaving squad", { error: err.message, email });
    return res.status(500).json({
      success: false,
      error: "Unable to leave squad. Please try again.",
    });
  }
}

module.exports = {
  createSquad,
  joinSquad,
  getSquad,
  leaveSquad,
  generateInviteCode,
};
