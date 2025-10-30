// middleware/setApiBase.js

const logger = require("../logger");

function setApiBase(req, res, next) {
  const protocol = req.protocol;
  const host = req.get("host");
  const baseURL = `${protocol}://${host}`;

  logger.info("API Base URL:", { baseURL });
  req.app.locals.apiBase = baseURL;
  next();
}

module.exports = { setApiBase };
