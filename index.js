const express = require("express");
const cors = require("cors");
require("dotenv").config();
const cookieParser = require("cookie-parser");

const connectDB = require("./src/database/connection");

// Routes
const authRoutes = require("./src/routes/authRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const productRoutes = require("./src/routes/productRoutes");
const invoiceRoutes = require("./src/routes/invoiceRoutes");
const settingsRoutes = require("./src/routes/settingsRoutes");
const statisticsRoutes = require("./src/routes/statisticsRoutes");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(cookieParser());

// Routes

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/products", productRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/settings", settingsRoutes);

// Test Route

app.get("/", (req, res) => {
  res.send("Inventory API Running");
});

// Cron Jobs

require("./src/cronjob/stockCron");

// Server Start

const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.log("Server start failed:", err.message);
  }
};

startServer();
