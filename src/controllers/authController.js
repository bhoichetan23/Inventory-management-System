const User = require("../models/UserModel");
const bcrypt = require("bcrypt");
const generateOTP = require("../utils/generateOTP");
const sendEmail = require("../utils/sendEmail");
const { generateAccessToken, generateRefreshToken } = require("../utils/token");
const jwt = require("jsonwebtoken");
const validatePassword = require("../utils/passwordValidator");
const validateEmail = require("../utils/emailValidator");

// Signup
const signup = async (req, res) => {
  try {
    let { name, email, password } = req.body;

    email = email.trim().toLowerCase();

    const emailErrors = validateEmail(email);
    if (emailErrors.length > 0) {
      return res
        .status(400)
        .json({ message: "Email validation failed", errors: emailErrors });
    }

    const exists = await User.findOne({ email });
    if (exists && exists.isVerified) {
      return res.status(400).json({ message: "Email already registered" });
    }

    if (exists && !exists.isVerified) {
      // RESEND OTP FLOW
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      exists.otp = otp;
      exists.otpExpiry = otpExpiry;

      await exists.save();

      sendEmail(
        email,
        "Verify your account",
        `<h3>Your OTP is: ${otp}</h3>`,
      ).catch(() => {});

      return res.status(200).json({
        message: "OTP generated",
        otp,
        requiresVerification: true,
      });
    }

    const errors = validatePassword(password);
    if (errors.length > 0) {
      return res.status(400).json({
        message: "Password validation failed",
        errors,
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await User.create({
      name,
      email,
      password: hashed,
      otp,
      otpExpiry,
    });

    sendEmail(
      email,
      "Verify your account",
      `<h3>Your OTP is: ${otp}</h3>`,
    ).catch(() => {});

    res.status(201).json({ message: "OTP generated", otp });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Verify  signup OTP
const verifySignupOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isVerified)
      return res.status(400).json({ message: "Account already verified" });

    if (String(user.otp) !== String(otp) || user.otpExpiry < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Login
const login = async (req, res) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const { password } = req.body;

    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.isVerified)
      return res.status(403).json({ message: "Account not verified" });

    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Refresh Token
const refreshAccessToken = (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) return res.status(401).json({ message: "Refresh token missing" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const newAccessToken = generateAccessToken(decoded.id);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ message: "Invalid refresh token" });
  }
};

// Forget password
const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    user.resetAllowed = false; // revoke any previous reset permission

    await user.save();

    sendEmail(
      email,
      "Verify your account",
      `<h3>Your OTP is: ${otp}</h3>`,
    ).catch(() => {});

    res.json({ message: "OTP generated", otp });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.resetAllowed)
      return res.status(400).json({ message: "OTP already verified" });

    if (String(user.otp) !== String(otp) || user.otpExpiry < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.resetAllowed = true;
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    res.json({ message: "OTP verified for password reset" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.resetAllowed) {
      return res.status(400).json({ message: "OTP verification required" });
    }

    const errors = validatePassword(newPassword);
    if (errors.length > 0) {
      return res.status(400).json({
        message: "Password validation failed",
        errors,
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    user.password = hashed;
    user.resetAllowed = false;

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Logout
const logout = (req, res) => {
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out successfully" });
};

module.exports = {
  signup,
  verifySignupOtp,
  login,
  refreshAccessToken,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  logout,
};
