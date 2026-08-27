const crypto = require("node:crypto");
const logger = require("../logger");
const redis = require("../config/redisClient");
const sharedData = require("../helper/shared-data");
const { validateSubscriberInput } = require("../helper/validateSubscriber");
const { getTransporter } = require("../config/mailTransporter");
const { createSession } = require("../middleware/subscriberSession");
const { setRoleCookie } = require("../helper/util");

const SIGNUP_KEY_PREFIX = "signup_key:";
const SIGNUP_KEY_TTL_SECONDS = 24 * 60 * 60; // 24h -- generous, a signup confirmation isn't as time-sensitive as a login link

// POST /subscribe  { email, cronPattern?, timezone? }
//
// Double opt-in, deliberately: a single-step "type an email, get
// subscribed immediately" flow would let anyone sign up someone ELSE's
// address without consent -- a real spam/deliverability risk once this
// is public. Requiring a confirmation click closes that gap, and is the
// same pattern virtually every mailing list product uses.
async function requestSignup(req, res) {
  const email = (req.body?.email || "").trim().toLowerCase();
  const { cronPattern, timezone } = req.body || {};

  // Format-level validation gets a real error response -- unlike /login,
  // this doesn't leak anything about EXISTING subscribers (it only says
  // whether the submitted input itself is well-formed), so there's no
  // enumeration concern here.
  const errors = validateSubscriberInput({ email, cronPattern, timezone });
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const GENERIC_RESPONSE = {
    message: "Check your inbox to confirm your subscription.",
  };

  try {
    const existing = await sharedData.getUserByEmail(email);
    if (existing) {
      // Same enumeration-safety reasoning as /login: don't reveal via a
      // different response shape that this email is already subscribed.
      logger.info("Signup requested for already-subscribed email", { email });
      return res.json(GENERIC_RESPONSE);
    }

    const token = crypto.randomBytes(32).toString("hex");
    await redis.set(
      SIGNUP_KEY_PREFIX + token,
      JSON.stringify({ email, cronPattern, timezone }),
      "EX",
      SIGNUP_KEY_TTL_SECONDS,
    );

    const baseUrl = res.locals.apiBase || `${req.protocol}://${req.get("host")}`;
    const confirmUrl = `${baseUrl}/confirm-subscription?token=${token}`;

    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.FROM_NAME
        ? `"${process.env.FROM_NAME}" <${process.env.FROM_USER}>`
        : process.env.FROM_USER,
      to: email,
      subject: "Confirm your Morning Routine subscription",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>One more step</h2>
          <p>Click below to confirm you'd like to receive Morning Routine emails at this address.</p>
          <p style="margin: 24px 0;">
            <a href="${confirmUrl}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
              Confirm subscription
            </a>
          </p>
          <p style="color:#666;font-size:13px;">If you didn't request this, you can safely ignore this email -- you won't be subscribed unless you click the link above.</p>
        </div>
      `,
    });

    logger.info("Signup confirmation sent", { email });
    return res.json(GENERIC_RESPONSE);
  } catch (error) {
    logger.error("❌ Failed to send signup confirmation", { error: error.message });
    // Deliberately still the generic success shape, same reasoning as
    // /login -- don't let a DB/SMTP failure leak subscriber existence via
    // a different response shape. The real error is logged server-side.
    return res.json(GENERIC_RESPONSE);
  }
}

// GET /confirm-subscription?token=...
async function confirmSignup(req, res) {
  const token = req.query.token;
  if (!token) {
    return res.redirect(302, "/?signup=missing_token");
  }

  try {
    const raw = await redis.get(SIGNUP_KEY_PREFIX + token);
    if (!raw) {
      return res.redirect(302, "/?signup=expired");
    }

    // One-time use, same as the login token.
    await redis.del(SIGNUP_KEY_PREFIX + token);

    const { email, cronPattern, timezone } = JSON.parse(raw);
    const result = await sharedData.addUser({ email, cronPattern, timezone });

    // If they double-clicked the link (or it somehow got confirmed
    // twice), don't error -- just log them in. The subscriber already
    // exists either way, which is what matters.
    if (result.created) {
      logger.info("New subscriber confirmed", { email });
      sendWelcomeEmail(email).catch((error) => {
        // Welcome email failing shouldn't block the signup itself --
        // they're already subscribed and about to be logged in
        // regardless. Logged, not thrown.
        logger.error("❌ Failed to send welcome email", { error: error.message, email });
      });
    }

    await createSession(res, email);
    setRoleCookie(res, "user");

    return res.redirect(302, "/user-dashboard");
  } catch (error) {
    logger.error("❌ Signup confirmation failed", { error: error.message });
    return res.redirect(302, "/?signup=error");
  }
}

async function sendWelcomeEmail(email) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.FROM_NAME
      ? `"${process.env.FROM_NAME}" <${process.env.FROM_USER}>`
      : process.env.FROM_USER,
    to: email,
    subject: "Welcome to Morning Routine 🌞",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You're all set!</h2>
        <p>You're subscribed to Morning Routine -- expect your first email soon.</p>
        <p>You can update your send time, timezone, or pause anytime from your dashboard. No need to email anyone to make changes.</p>
        <p style="color:#666;font-size:13px;margin-top:24px;">Didn't mean to sign up? Every routine email includes a one-click unsubscribe link.</p>
      </div>
    `,
  });
  logger.info("Welcome email sent", { email });
}

module.exports = { requestSignup, confirmSignup };
