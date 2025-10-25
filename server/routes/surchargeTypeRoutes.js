// Plik: server/routes/surchargeTypeRoutes.js
const express = require('express');
const router = express.Router();
const surchargeTypeController = require('../controllers/surchargeTypeController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Wszystkie operacje na typach dopłat wymagają uprawnień admina
router.use(authenticateToken, requireRole(['admin']));

router.get('/', surchargeTypeController.getAll);
router.post('/', surchargeTypeController.create);
router.put('/:id', surchargeTypeController.update);
router.delete('/:id', surchargeTypeController.delete);

module.exports = router;