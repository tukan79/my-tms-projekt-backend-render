// Plik server/routes/customerRoutes.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Wszystkie trasy chronione, dostępne tylko dla admina
router.use(authenticateToken, requireRole(['admin']));

router.get('/', customerController.getAllCustomers);
router.get('/export', customerController.exportCustomers);
router.post('/', customerController.createCustomer);
router.post('/import', customerController.importCustomers);
router.put('/:customerId', customerController.updateCustomer);
router.delete('/:customerId', customerController.deleteCustomer);

module.exports = router;