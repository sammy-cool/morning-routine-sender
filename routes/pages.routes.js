const express = require("express");
const router = express.Router();

const pagesController = require("../controllers/pages.controller");

// NOTE: /admin-dashboard is intentionally NOT here -- in the original
// index.js it was registered BEFORE express.static(), while these 6 were
// registered AFTER it. Since manifest.json/sw.js are real files served by
// express.static("public"), that ordering can change which one wins if a
// matching static file exists. Preserving it exactly rather than
// collapsing into one mount point: see index.js for where adminDashboard
// is wired separately, in its original position.
router.get("/health", pagesController.health);
router.get("/offline", pagesController.offline);
router.get("/manifest.json", pagesController.manifest);
router.get("/sw.js", pagesController.serviceWorker);
router.get("/user-dashboard", pagesController.userDashboard);
router.get("/", pagesController.root);

module.exports = router;
