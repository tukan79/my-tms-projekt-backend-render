// Plik: server/controllers/invoiceController.js
const invoiceService = require('../services/invoiceService.js');

const createInvoice = async (req, res, next) => {
  try {
    const { customerId, startDate, endDate } = req.body;
    if (!customerId || !startDate || !endDate) {
      return res.status(400).json({ error: 'customerId, startDate, and endDate are required.' });
    }

    const newInvoice = await invoiceService.createInvoice(customerId, startDate, endDate);
    res.status(201).json(newInvoice);
  } catch (error) {
    // Przekazujemy błąd do centralnego middleware'a obsługi błędów
    next(error);
  }
};

module.exports = {
  createInvoice,
};