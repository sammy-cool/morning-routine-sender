const express = require("express");
const router = express.Router();

const pagesController = require("../controllers/pages.controller");

router.get("/health", pagesController.health);
router.get("/offline", pagesController.offline);
router.get("/manifest.json", pagesController.manifest);
router.get("/sw.js", pagesController.serviceWorker);
router.get("/robots.txt", pagesController.robots);
router.get("/sitemap.xml", pagesController.sitemap);
router.get("/llms.txt", pagesController.llmsTxt);
router.get("/llms-full.txt", pagesController.llmsFullTxt);
router.get("/.well-known/llms.txt", pagesController.llmsTxt);
router.get("/about", pagesController.about);
router.get("/streak/:handleOrEmail", pagesController.streakShare);
router.get("/user-dashboard", pagesController.userDashboard);
router.get("/dashboard", pagesController.userDashboard);
router.get("/", pagesController.root);

module.exports = router;
