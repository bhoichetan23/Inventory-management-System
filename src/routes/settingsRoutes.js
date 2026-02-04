const express = require("express");
const protect = require("../middlewares/authMiddlewares");
const {
  getProfile,
  updateProfile,
  changePassword,
} = require("../controllers/settingsController");

const router = express.Router();

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/password", protect, changePassword);

module.exports = router;
