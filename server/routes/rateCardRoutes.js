// Plik server/routes/rateCardRoutes.js
const express = require('express');
const router = express.Router();
const rateCardController = require('../controllers/rateCardController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken, requireRole(['admin']));

// Trasy dla cenników (Rate Cards)
router.get('/', rateCardController.getAllRateCards);
router.post('/', rateCardController.createRateCard);
router.delete('/:rateCardId', rateCardController.deleteRateCard);
router.get('/:rateCardId/export', rateCardController.exportRateEntries);
router.post('/:rateCardId/import', rateCardController.importRateEntries);
router.get('/:rateCardId/customers', rateCardController.getCustomersForRateCard);
router.post('/:rateCardId/customers/:customerId', rateCardController.assignCustomer);
router.delete('/:rateCardId/customers/:customerId', rateCardController.unassignCustomer);

// Trasy dla stawek (Rate Entries) w ramach cennika
router.get('/:rateCardId/entries', rateCardController.getEntriesForCard);
router.post('/:rateCardId/entries', rateCardController.createEntryForCard);
router.put('/entries/:entryId', rateCardController.updateEntry);
router.delete('/entries/:entryId', rateCardController.deleteEntry);

module.exports = router;