const Product = require("../models/ProductModel");
const cloudinary = require("../utils/cloudinary");
const fs = require("fs");
const Transaction = require("../models/TransactionalModel");
const Invoice = require("../models/InvoiceModel");
const generateInvoiceNumber = require("../utils/invoiceNumber");

const PRODUCT_CATEGORIES = [
  "Beverage",
  "Snack",
  "Grocery",
  "Home Product",
  "Personal Care",
  "Cleaning Supplies",
  "Stationery",
  "Electronics",
  "Medicine",
  "Baby Products",
  "Pet Supplies",
  "Frozen Food",
  "Bakery",
  "Other",
];

// GET PRODUCTS
const getProducts = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = req.query.search || "";

    const query = {
      user: req.user._id,
      name: { $regex: search, $options: "i" },
    };

    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// CREATE PRODUCT (PURCHASE)
const createProduct = async (req, res) => {
  try {
    const {
      name,
      productId,
      category,
      price,
      quantity,
      unit,
      expiryDate,
      threshold,
    } = req.body;

    const normalizedCategory = PRODUCT_CATEGORIES.find(
      (c) => c.toLowerCase() === category.toLowerCase(),
    );

    if (!normalizedCategory) {
      return res.status(400).json({
        message: `Invalid category. Choose from: ${PRODUCT_CATEGORIES.join(", ")}`,
      });
    }

    // Per-user productId uniqueness
    const exists = await Product.findOne({
      productId,
      user: req.user._id,
    });

    if (exists) {
      return res.status(400).json({ message: "Product ID already exists" });
    }

    let imageUrl = "";

    if (req.file) {
      const upload = await cloudinary.uploader.upload(req.file.path);
      imageUrl = upload.secure_url;
      fs.unlinkSync(req.file.path);
    }

    const status =
      Number(quantity) === 0
        ? "Out of Stock"
        : Number(quantity) <= Number(threshold)
          ? "Low Stock"
          : "In Stock";

    const product = await Product.create({
      user: req.user._id,
      image: imageUrl,
      name,
      productId,
      category: normalizedCategory,
      price: Number(price),
      quantity: Number(quantity),
      unit,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      threshold: Number(threshold),
      status,
    });

    await Transaction.create({
      user: req.user._id,
      product: product._id,
      quantity: Number(quantity),
      amount: Number(quantity) * Number(price),
      type: "PURCHASE",
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// CSV UPLOAD (PURCHASE)
const uploadCSVProducts = async (req, res) => {
  try {
    const fileData = fs.readFileSync(req.file.path, "utf8");
    fs.unlinkSync(req.file.path);

    const lines = fileData.split("\n").filter((l) => l.trim() !== "");
    if (lines.length < 2) {
      return res.status(400).json({ message: "CSV file is empty" });
    }

    const normalize = (h) => h.toLowerCase().replace(/[\s_]/g, "");

    const parseNumber = (value) => {
      if (value === undefined || value === null) return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const parseDate = (value) => {
      if (!value) return null;

      // Excel serial date (e.g. 45291)
      if (!isNaN(value) && Number(value) > 30000) {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + Number(value) * 86400000);
      }

      // YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      }

      // DD-MM-YYYY or DD/MM/YYYY (Excel default)
      const match = value.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
      if (match) {
        const [, dd, mm, yyyy] = match;
        const d = new Date(`${yyyy}-${mm}-${dd}`);
        return isNaN(d.getTime()) ? null : d;
      }

      return null;
    };

    const rawHeaders = lines[0].split(",").map((h) => h.trim());
    const normalizedHeaders = rawHeaders.map(normalize);

    const headerAliases = {
      name: ["name", "productname"],
      productId: ["productid", "sku"],
      price: ["price", "cost"],
      quantity: ["quantity", "qty"],
      unit: ["unit"],
      threshold: ["threshold", "minstock"],
      category: ["category"],
      expiryDate: ["expirydate", "expiry"],
    };

    const headerIndexMap = {};

    Object.entries(headerAliases).forEach(([key, aliases]) => {
      const index = normalizedHeaders.findIndex((h) => aliases.includes(h));
      if (index !== -1) {
        headerIndexMap[key] = index;
      }
    });

    const mandatoryFields = [
      "name",
      "productId",
      "price",
      "quantity",
      "unit",
      "threshold",
    ];

    for (const field of mandatoryFields) {
      if (headerIndexMap[field] === undefined) {
        return res.status(400).json({
          message: `Mandatory column missing: ${field}`,
        });
      }
    }

    let successCount = 0;
    const errorRows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const getValue = (field) => values[headerIndexMap[field]] || "";

      for (const field of mandatoryFields) {
        if (!getValue(field)) {
          return res.status(400).json({
            message: `Upload stopped. Row ${i + 1} missing mandatory field: ${field}`,
          });
        }
      }

      const quantity = parseNumber(getValue("quantity"));
      const threshold = parseNumber(getValue("threshold"));
      const price = parseNumber(getValue("price"));

      if (quantity === null || threshold === null || price === null) {
        return res.status(400).json({
          message: `Upload stopped. Row ${i + 1} has invalid numeric value`,
        });
      }

      const status =
        quantity === 0
          ? "Out of Stock"
          : quantity <= threshold
            ? "Low Stock"
            : "In Stock";

      try {
        const createdProduct = await Product.create({
          user: req.user._id,
          name: getValue("name"),
          productId: getValue("productId"),
          price,
          quantity,
          unit: getValue("unit"),
          threshold,
          category: PRODUCT_CATEGORIES.includes(getValue("category"))
            ? getValue("category")
            : "Other",
          expiryDate: parseDate(getValue("expiryDate")),
          status,
        });

        await Transaction.create({
          user: req.user._id,
          product: createdProduct._id,
          quantity,
          amount: quantity * price,
          type: "PURCHASE",
        });

        successCount++;
      } catch (err) {
        errorRows.push({
          row: i + 1,
          error: err.message,
        });
      }
    }

    res.json({ successCount, errorRows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// BUY PRODUCT (SALE)
const buyProduct = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const product = await Product.findOne({
      productId,
      user: req.user._id,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (Number(quantity) > product.quantity) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    product.quantity -= Number(quantity);

    product.status =
      product.quantity === 0
        ? "Out of Stock"
        : product.quantity <= product.threshold
          ? "Low Stock"
          : "In Stock";

    await product.save();

    const amount = Number(quantity) * Number(product.price);

    await Transaction.create({
      user: req.user._id,
      product: product._id,
      quantity: Number(quantity),
      amount,
      type: "SALE",
    });

    const invoiceId = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      user: req.user._id,
      invoiceId,
      product: product._id,
      quantity: Number(quantity),
      price: Number(product.price),
      amount,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.json({
      message: "Purchase successful",
      invoice,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getProducts,
  createProduct,
  uploadCSVProducts,
  buyProduct,
};
