const Transaction = require("../models/TransactionalModel");
const Product = require("../models/ProductModel");

// Home dashboard
const getHomeDashboard = async (req, res) => {
  try {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    // Sales and purchase
    const sales = await Transaction.find({
      user: req.user._id,
      type: "SALE",
    });

    const purchases = await Transaction.find({
      user: req.user._id,
      type: "PURCHASE",
    });

    const salesAmount = sales.reduce((s, i) => s + i.amount, 0);
    const purchaseAmount = purchases.reduce((s, i) => s + i.amount, 0);

    // Inventory
    const totalProducts = await Product.countDocuments({
      user: req.user._id,
    });

    const inStock = await Product.countDocuments({
      user: req.user._id,
      quantity: { $gt: 0 },
    });

    const lowStock = await Product.countDocuments({
      user: req.user._id,
      $expr: { $lte: ["$quantity", "$threshold"] },
    });

    const outOfStock = await Product.countDocuments({
      user: req.user._id,
      quantity: 0,
    });

    const categories = await Product.distinct("category", {
      user: req.user._id,
    });

    // last 7 days data
    const productsLast7Days = await Product.countDocuments({
      user: req.user._id,
      createdAt: { $gte: last7Days },
    });

    const revenueAgg = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: "SALE",
          createdAt: { $gte: last7Days },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$amount" },
        },
      },
    ]);

    const revenueLast7Days = revenueAgg[0]?.revenue || 0;

    const topSellingAgg = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: "SALE",
          createdAt: { $gte: last7Days },
        },
      },
      {
        $group: {
          _id: null,
          quantity: { $sum: "$quantity" },
          revenue: { $sum: "$amount" },
        },
      },
    ]);

    res.json({
      salesOverview: {
        count: sales.length,
        revenue: salesAmount,
        cost: purchaseAmount,
        profit: salesAmount - purchaseAmount,
      },

      purchaseOverview: {
        count: purchases.length,
        cost: purchaseAmount,
      },

      inventorySummary: {
        inStock,
        lowStock,
        outOfStock,
        totalProducts,
      },

      productSummary: {
        categories: categories.length,
      },

      inventoryStats: {
        categoriesCount: categories.length,
        productsLast7Days,
        revenueLast7Days,
        topSellingQty7Days: topSellingAgg[0]?.quantity || 0,
        topSellingRevenue7Days: topSellingAgg[0]?.revenue || 0,
        lowStockCount: lowStock,
        outOfStockCount: outOfStock,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Dashboard Graph
const getDashboardGraph = async (req, res) => {
  try {
    const range = req.query.range || "monthly";

    let groupFormat;
    if (range === "daily") groupFormat = "%Y-%m-%d";
    else if (range === "weekly") groupFormat = "%Y-%U";
    else if (range === "yearly") groupFormat = "%Y";
    else groupFormat = "%Y-%m";

    const data = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
        },
      },
      {
        $group: {
          _id: {
            period: {
              $dateToString: { format: groupFormat, date: "$createdAt" },
            },
            type: "$type",
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.period": 1 } },
    ]);

    const map = {};

    data.forEach((d) => {
      if (!map[d._id.period]) {
        map[d._id.period] = { sales: 0, purchases: 0 };
      }

      if (d._id.type === "SALE") {
        map[d._id.period].sales = d.total;
      } else {
        map[d._id.period].purchases = d.total;
      }
    });

    const labels = Object.keys(map);
    const sales = labels.map((l) => map[l].sales);
    const purchases = labels.map((l) => map[l].purchases);

    res.json({ labels, sales, purchases });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Dashboard Summary
const getDashboardSummary = async (req, res) => {
  try {
    const sales = await Transaction.find({
      user: req.user._id,
      type: "SALE",
    });

    const purchases = await Transaction.find({
      user: req.user._id,
      type: "PURCHASE",
    });

    res.json({
      sales: {
        count: sales.length,
        amount: sales.reduce((s, i) => s + i.amount, 0),
      },
      purchases: {
        count: purchases.length,
        amount: purchases.reduce((s, i) => s + i.amount, 0),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Top Selling Products
const getTopSellingProducts = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 5;

    const result = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: "SALE",
        },
      },
      {
        $group: {
          _id: "$product",
          totalSold: { $sum: "$quantity" },
          revenue: { $sum: "$amount" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          productId: "$product.productId",
          name: "$product.name",
          image: "$product.image",
          totalSold: 1,
          revenue: 1,
        },
      },
    ]);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Low Stocks
const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      user: req.user._id,
      $expr: { $lte: ["$quantity", "$threshold"] },
    }).sort({ quantity: 1 });

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Expiring Products
const getExpiringProducts = async (req, res) => {
  try {
    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);

    const products = await Product.find({
      user: req.user._id,
      expiryDate: { $lte: next30Days, $ne: null },
    }).sort({ expiryDate: 1 });

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Top Stats
const getTopStats = async (req, res) => {
  try {
    const sales = await Transaction.find({
      user: req.user._id,
      type: "SALE",
    });

    const revenue = sales.reduce((s, i) => s + i.amount, 0);
    const productsSold = sales.reduce((s, i) => s + i.quantity, 0);

    const productsInStock = await Product.countDocuments({
      user: req.user._id,
      quantity: { $gt: 0 },
    });

    res.json({
      revenue,
      productsSold,
      productsInStock,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getHomeDashboard,
  getDashboardGraph,
  getDashboardSummary,
  getTopSellingProducts,
  getLowStockProducts,
  getExpiringProducts,
  getTopStats,
};
