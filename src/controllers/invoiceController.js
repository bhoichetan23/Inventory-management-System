const Invoice = require("../models/InvoiceModel");
const PDFDocument = require("pdfkit");

// GET INVOICES (LIST)
const getInvoices = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = req.query.search || "";

    const query = {
      user: req.user._id,
      invoiceId: { $regex: search, $options: "i" },
    };

    const total = await Invoice.countDocuments(query);

    const invoices = await Invoice.find(query)
      .populate("product", "name productId price")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      invoices,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE INVOICE STATUS
const updateInvoiceStatus = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    invoice.status = "Paid";
    await invoice.save();

    res.json({
      message: "Invoice marked as paid",
      invoice,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE INVOICE
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    await invoice.deleteOne();
    res.json({ message: "Invoice deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// VIEW SINGLE INVOICE
const getSingleInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate("product", "name productId price");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DOWNLOAD INVOICE PDF
const downloadInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate("product", "name price");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${invoice.invoiceId}.pdf`,
    );
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    // HEADER
    doc.fontSize(22).text("INVOICE", { align: "center" });
    doc.moveDown();

    doc.fontSize(10);
    doc.text("Inventory System Pvt Ltd");
    doc.text("Mumbai, India");
    doc.text("support@inventory.com");
    doc.moveDown();

    doc.text(`Invoice ID: ${invoice.invoiceId}`);
    doc.text(`Date: ${invoice.createdAt.toDateString()}`);
    doc.text(`Status: ${invoice.status}`);
    doc.moveDown();

    // TABLE HEADER
    doc.fontSize(12).text("Product", 40, doc.y, { continued: true });
    doc.text("Price", 250, doc.y, { continued: true });
    doc.text("Qty", 320, doc.y, { continued: true });
    doc.text("Total", 380, doc.y);
    doc.moveDown();

    doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();

    // PRODUCT ROW
    doc.moveDown(0.5);
    doc.text(invoice.product.name, 40, doc.y, { continued: true });
    doc.text(`₹${invoice.price}`, 250, doc.y, { continued: true });
    doc.text(invoice.quantity, 320, doc.y, { continued: true });
    doc.text(`₹${invoice.amount}`, 380, doc.y);

    doc.moveDown();
    doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();

    // TOTAL
    doc.moveDown();
    doc.fontSize(14).text(`Grand Total: ₹${invoice.amount}`, {
      align: "right",
    });

    doc.moveDown(2);
    doc.fontSize(10).text("Thank you for your business!", {
      align: "center",
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// INVOICE STATS
const getStats = async (req, res) => {
  try {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const [
      totalInvoices,
      recentInvoices,
      paidInvoices,
      unpaidInvoices,
      paidLast7Days,
    ] = await Promise.all([
      Invoice.countDocuments({ user: req.user._id }),
      Invoice.countDocuments({
        user: req.user._id,
        createdAt: { $gte: last7Days },
      }),
      Invoice.countDocuments({
        user: req.user._id,
        status: "Paid",
      }),
      Invoice.countDocuments({
        user: req.user._id,
        status: "Unpaid",
      }),
      Invoice.aggregate([
        {
          $match: {
            user: req.user._id,
            status: "Paid",
            createdAt: { $gte: last7Days },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    const unpaidAmountAgg = await Invoice.aggregate([
      {
        $match: {
          user: req.user._id,
          status: "Unpaid",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    res.json({
      totalInvoices,
      recentTransactions: recentInvoices,
      processedInvoices: paidInvoices,
      paidLast7DaysAmount: paidLast7Days[0]?.total || 0,
      unpaidAmount: unpaidAmountAgg[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getInvoices,
  updateInvoiceStatus,
  deleteInvoice,
  getSingleInvoice,
  downloadInvoice,
  getStats,
};
