const express = require("express");
const protect = require("../middlewares/authMiddlewares");

const {
  getDashboardGraph,
  getDashboardSummary,
  getTopSellingProducts,
  getLowStockProducts,
  getExpiringProducts,
  getHomeDashboard,
  getTopStats,
} = require("../controllers/dashboardController");

const router = express.Router();

router.get("/graph", protect, getDashboardGraph);
router.get("/summary", protect, getDashboardSummary);
router.get("/top-products", protect, getTopSellingProducts);
router.get("/low-stock", protect, getLowStockProducts);
router.get("/expiring", protect, getExpiringProducts);
router.get("/home", protect, getHomeDashboard);
router.get("/top-stats", protect, getTopStats);

module.exports = router;
