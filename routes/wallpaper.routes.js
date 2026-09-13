// routes/wallpaper.routes.js
const express = require("express");
const router = express.Router();

const wallpaperController = require("../controllers/wallpaper.controller");
const { requireSubscriberSession } = require("../middleware/subscriberSession");

// Public lockscreen wallpaper SVG endpoints
router.get("/wallpaper/:handleOrEmail", wallpaperController.getWallpaper);
router.get("/wallpaper", wallpaperController.getWallpaper);
router.get("/api/wallpaper/:token", wallpaperController.getWallpaperByToken);
router.get("/api/wallpaper", wallpaperController.getWallpaper);

// Authenticated wallpaper endpoints
router.get("/me/wallpaper.svg", requireSubscriberSession, wallpaperController.getMyWallpaper);
router.get("/me/wallpaper", requireSubscriberSession, wallpaperController.getMyWallpaper);

module.exports = router;
