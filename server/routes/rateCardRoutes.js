// Plik: server/routes/rateCardRoutes.js
const express = require('express');
const rateCardController = require('../controllers/rateCardController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware.js');

const router = express.Router();
router.get('/', authenticateToken, requireRole(['admin']), rateCardController.getAllRateCards);
router.post('/', authenticateToken, requireRole(['admin']), rateCardController.createRateCard);
router.put('/:id', authenticateToken, requireRole(['admin']), rateCardController.updateRateCard);
router.delete('/:id', authenticateToken, requireRole(['admin']), rateCardController.deleteRateCard);
router.post('/:id/entries/import', authenticateToken, requireRole(['admin']), rateCardController.importRateEntries);

// Routes for rate entries and customer assignments
router.get('/:id/entries', authenticateToken, requireRole(['admin']), rateCardController.getEntriesByRateCardId);
router.get('/:id/customers', authenticateToken, requireRole(['admin']), rateCardController.getCustomersByRateCardId);
router.post('/:id/customers/:customerId', authenticateToken, requireRole(['admin']), rateCardController.assignCustomer);
router.post('/:id/customers', authenticateToken, requireRole(['admin']), rateCardController.assignCustomersBulk); // Nowa trasa
router.delete('/:id/customers/:customerId', authenticateToken, requireRole(['admin']), rateCardController.unassignCustomer);
router.get('/debug/zones', rateCardController.debugZones);
router.post('/check-zone-mapping', rateCardController.checkZoneMapping);

module.exports = router;
