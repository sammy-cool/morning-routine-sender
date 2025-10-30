// middleware/setApiBase.js

const logger = require("../logger");

function setApiBase(req, res, next) {
  logger.info("🔍 Setting API base URL for...\n", { path: req.path });

  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const host = req.get("host");
  const baseURL = `${protocol}://${host}`;
  const renderUrl = `${process.env.RENDER_URL}`;

  logger.info("API Base URL:", { baseURL });
  req.app.locals.apiBase = baseURL;
  req.app.locals.officialDomain = renderUrl;
  next();
}

module.exports = { setApiBase };
