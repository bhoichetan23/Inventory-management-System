const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    image: {
      type: String,
    },

    name: {
      type: String,
      required: true,
    },

    productId: {
      type: String,
      required: true,
      unique: true,
    },

    category: {
      type: String,
      enum: [
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
      ],
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
    },

    unit: {
      type: String,
      required: true,
    },

    expiryDate: {
      type: Date,
    },

    threshold: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Product", productSchema);
