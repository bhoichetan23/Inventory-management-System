const express = require("express");
const protect = require("../middlewares/authMiddlewares");
const upload = require("../middlewares/uploadMiddlewares");
const {
  getProducts,
  createProduct,
  uploadCSVProducts,
  buyProduct,
} = require("../controllers/productController");

const router = express.Router();

// get product
router.get("/", protect, getProducts);

// Create single product
router.post("/", protect, upload.single("image"), createProduct);

// Upload CSV products
router.post("/csv", protect, upload.single("file"), uploadCSVProducts);

// Buy simulation
router.post("/buy", protect, buyProduct);

module.exports = router;
