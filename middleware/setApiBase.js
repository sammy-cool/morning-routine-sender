// middleware/setApiBase.js

const logger = require("../logger");

function setApiBase(req, res, next) {
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const host = req.get("host");

  // deployment official URL
  const renderUrl = process.env.RENDER_URL;

  let baseURL;
  if (host) {
    baseURL = `${protocol}://${host}`;
  } else {
    baseURL = renderUrl;
  }

  logger.info("🔍 Setting API base URL for...\n", {
    baseURL: baseURL,
    path: req.path || "unknown",
    ip: req.ip,
    timestamp: Date.now(),
  });
  req.app.locals.apiBase = baseURL;
  req.app.locals.officialDomain = renderUrl;
  next();
}

module.exports = { setApiBase };
