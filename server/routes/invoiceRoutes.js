// Plik: server/routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const invoiceController = require('../controllers/invoiceController');

// Wszystkie trasy dla faktur wymagają uwierzytelnienia i roli admina lub dyspozytora
router.use(authenticateToken, requireRole(['admin', 'dispatcher']));

router.post('/', invoiceController.createInvoice);
router.get('/', invoiceController.getAllInvoices);
router.get('/:id/pdf', invoiceController.downloadInvoicePDF);

module.exports = router;