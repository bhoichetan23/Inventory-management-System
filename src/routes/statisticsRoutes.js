const express = require("express");
const protect = require("../middlewares/authMiddlewares");
const {
  getStatisticsSummary,
  getStatisticsGraph,
  getStatisticsTopProducts,
} = require("../controllers/statisticsController");

const router = express.Router();

router.get("/summary", protect, getStatisticsSummary);
router.get("/graph", protect, getStatisticsGraph);
router.get("/top-products", protect, getStatisticsTopProducts);

module.exports = router;
