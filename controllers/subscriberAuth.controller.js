const crypto = require("node:crypto");
const validator = require("validator");
const logger = require("../logger");
const redis = require("../config/redisClient");
const sharedData = require("../helper/shared-data");
const { getTransporter } = require("../config/mailTransporter");
const { createSession, destroySession } = require("../middleware/subscriberSession");
const { setRoleCookie } = require("../helper/util");

const LOGIN_KEY_PREFIX = "login_key:";
const LOGIN_KEY_TTL_SECONDS = 15 * 60; // 15 min -- enough time to check email and click

// POST /login  { email }
// Always responds with the same generic message regardless of whether the
// email is actually subscribed -- deliberately, to avoid leaking which
// addresses exist in the subscribers table to anyone probing this endpoint
// (email enumeration).
async function requestLogin(req, res) {
  const email = (req.body?.email || "").trim().toLowerCase();
  const GENERIC_RESPONSE = {
    message: "If that email is subscribed, a login link has been sent.",
  };

  if (!email || !validator.isEmail(email)) {
    // Still generic on format errors too -- a real validation error here
    // ("not a valid email") would itself leak information via timing/
    // response-shape differences versus the enumeration-safe path below.
    return res.json(GENERIC_RESPONSE);
  }

  try {
    const subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      logger.info("Login requested for unknown email", { email });
      return res.json(GENERIC_RESPONSE);
    }

    const token = crypto.randomBytes(32).toString("hex");
    await redis.set(LOGIN_KEY_PREFIX + token, email, "EX", LOGIN_KEY_TTL_SECONDS);

    const baseUrl = res.locals.apiBase || `${req.protocol}://${req.get("host")}`;
    const loginUrl = `${baseUrl}/verify-login?token=${token}`;

    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.FROM_NAME
        ? `"${process.env.FROM_NAME}" <${process.env.FROM_USER}>`
        : process.env.FROM_USER,
      to: email,
      subject: "Your Morning Routine login link",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Log in to your dashboard</h2>
          <p>Click the button below to view your subscription -- your send history, and to update your preferences or pause anytime.</p>
          <p style="margin: 24px 0;">
            <a href="${loginUrl}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
              Log in
            </a>
          </p>
          <p style="color:#666;font-size:13px;">This link expires in 15 minutes and can only be used once. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    logger.info("Login link sent", { email });
    return res.json(GENERIC_RESPONSE);
  } catch (error) {
    // Deliberately still generic to the client -- log the real error
    // server-side, don't leak DB/SMTP failures into a response shape that
    // would itself reveal whether the email exists.
    logger.error("❌ Failed to send login link", { error: error.message });
    return res.json(GENERIC_RESPONSE);
  }
}

// GET /verify-login?token=...
async function verifyLogin(req, res) {
  const token = req.query.token;
  if (!token) {
    return res.redirect(302, "/?login=missing_token");
  }

  try {
    const email = await redis.get(LOGIN_KEY_PREFIX + token);
    if (!email) {
      return res.redirect(302, "/?login=expired");
    }

    // One-time use -- delete immediately, same pattern as the admin key flow.
    await redis.del(LOGIN_KEY_PREFIX + token);

    await createSession(res, email);
    setRoleCookie(res, "user");

    logger.info("Subscriber logged in", { email });
    return res.redirect(302, "/user-dashboard");
  } catch (error) {
    logger.error("❌ Login verification failed", { error: error.message });
    return res.redirect(302, "/?login=error");
  }
}

// POST /logout
async function logout(req, res) {
  await destroySession(req, res);
  return res.json({ message: "Logged out" });
}

module.exports = { requestLogin, verifyLogin, logout };
