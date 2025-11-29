// Plik: server/controllers/invoiceController.js
const invoiceService = require('../services/invoiceService.js');
const invoicePdfService = require('../services/invoicePdfService.js');

exports.createInvoice = async (req, res, next) => {
  try {
    const { customerId, startDate, endDate } = req.body;

    // Lepsza walidacja ID (== null łapie undefined i null)
    if (customerId == null || !startDate || !endDate) {
      return res.status(400).json({
        error: 'customerId, startDate, and endDate are required.',
      });
    }

    // Walidacja dat
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'startDate and endDate must be valid ISO date strings.',
      });
    }

    if (end < start) {
      return res.status(400).json({
        error: 'endDate cannot be earlier than startDate.',
      });
    }

    const invoice = await invoiceService.createInvoice(customerId, start, end);
    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
};

exports.getAllInvoices = async (req, res, next) => {
  try {
    const invoices = await invoiceService.findAllInvoices();
    res.status(200).json(invoices || []);
  } catch (error) {
    next(error);
  }
};

exports.downloadInvoicePDF = async (req, res, next) => {
  try {
    const { id } = req.params;

    const parsedId = Number.parseInt(id, 10);
    if (Number.isNaN(parsedId)) {
      return res.status(400).json({ error: 'Invoice ID must be a valid number.' });
    }

    const pdfBuffer = await invoicePdfService.generateInvoicePDF(parsedId);

    if (!pdfBuffer) {
      return res.status(404).json({
        error: `Invoice with ID ${parsedId} not found.`,
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice_${parsedId}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
