const User = require("../models/UserModel");
const bcrypt = require("bcrypt");

//  GET PROFILE
const getProfile = async (req, res) => {
  try {
    const user = req.user;

    res.json({
      name: user.name,
      lastName: user.lastName || "No last name available",
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//UPDATE PROFILE
const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const user = req.user;

    user.name = name;
    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//CHANGE PASSWORD
const changePassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const user = req.user;

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
};
