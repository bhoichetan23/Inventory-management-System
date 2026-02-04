const express = require("express");
const protect = require("../middlewares/authMiddlewares");
const {
  getInvoices,
  updateInvoiceStatus,
  deleteInvoice,
  getSingleInvoice,
  downloadInvoice,
  getStats,
} = require("../controllers/invoiceController");

const router = express.Router();

router.get("/", protect, getInvoices); // list
router.get("/stats", protect, getStats);
router.get("/:id", protect, getSingleInvoice); // view
router.put("/:id/status", protect, updateInvoiceStatus);
router.delete("/:id", protect, deleteInvoice);
router.get("/:id/download", protect, downloadInvoice);

module.exports = router;
