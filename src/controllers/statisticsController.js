const Transaction = require("../models/TransactionalModel");
const Product = require("../models/ProductModel");

// SUMMARY CARDS
const getStatisticsSummary = async (req, res) => {
  try {
    const sales = await Transaction.find({
      user: req.user._id,
      type: "SALE",
    });

    const purchases = await Transaction.find({
      user: req.user._id,
      type: "PURCHASE",
    });

    const totalRevenue = sales.reduce((s, i) => s + i.amount, 0);
    const totalCost = purchases.reduce((s, i) => s + i.amount, 0);

    const productsSold = sales.reduce((s, i) => s + i.quantity, 0);

    const productsInStock = await Product.countDocuments({
      user: req.user._id,
      quantity: { $gt: 0 },
    });

    res.json({
      totalRevenue,
      totalCost,
      profit: totalRevenue - totalCost,
      productsSold,
      productsInStock,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GRAPH
const getStatisticsGraph = async (req, res) => {
  try {
    const range = req.query.range || "monthly";

    let format = "%Y-%m";
    if (range === "daily") format = "%Y-%m-%d";
    if (range === "weekly") format = "%Y-%U";
    if (range === "yearly") format = "%Y";

    const data = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
        },
      },
      {
        $group: {
          _id: {
            period: { $dateToString: { format, date: "$createdAt" } },
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

//  TOP PRODUCTS
const getStatisticsTopProducts = async (req, res) => {
  try {
    const data = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: "SALE",
          product: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$product",
          totalSold: { $sum: "$quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 6 },
    ]);

    if (!data.length) {
      return res.json([]);
    }

    const populated = await Product.populate(data, {
      path: "_id",
      select: "name image",
    });

    const result = populated
      .filter((p) => p._id)
      .map((p) => ({
        name: p._id.name,
        image: p._id.image,
        totalSold: p.totalSold,
      }));

    res.json(result);
  } catch (err) {
    console.error("Top products error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getStatisticsSummary,
  getStatisticsGraph,
  getStatisticsTopProducts,
};
