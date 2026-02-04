const express = require("express");
const {
  signup,
  verifySignupOtp,
  login,
  refreshAccessToken,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  logout,
} = require("../controllers/authController");

const router = express.Router();

router.post("/signup", signup);
router.post("/verify-signup-otp", verifySignupOtp);
router.post("/login", login);
router.post("/refresh-token", refreshAccessToken);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);
router.post("/logout", logout);

module.exports = router;
