// middleware/setApiBase.js

const logger = require("../logger");

function setApiBase(req, res, next) {
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const host = req.get("host");

  // deployment official URL
  const renderUrl = process.env.RENDER_URL;

  let baseURL;
  if (renderUrl) {
    baseURL = renderUrl;
  } else if (host) {
    baseURL = `${protocol}://${host}`;
  } else {
    baseURL = "http://localhost:3000"; // fallback
  }

  logger.debug("API base URL configured", {
    baseURL,
    path: req.path || "unknown",
    ip: req.ip,
  });
  res.locals.apiBase = baseURL;
  res.locals.officialDomain = renderUrl;
  next();
}

module.exports = { setApiBase };
