const Invoice = require("../models/InvoiceModel");

const generateInvoiceNumber = async () => {
  const last = await Invoice.findOne().sort({ createdAt: -1 });

  if (!last) return "INV-1001";

  const num = parseInt(last.invoiceId.split("-")[1]) + 1;
  return `INV-${num}`;
};

module.exports = generateInvoiceNumber;
