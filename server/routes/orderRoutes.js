// Plik server/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const orderController = require('../controllers/orderController');

// Wszystkie trasy dla zleceń wymagają autentykacji
router.use(authenticateToken, requireRole(['admin', 'dispatcher']));

router.get('/', orderController.getAllOrders);
router.post('/', orderController.createOrder);
router.post('/import', orderController.importOrders);
router.put('/:id', orderController.updateOrder);
router.delete('/bulk', orderController.bulkDeleteOrders); // Nowa trasa
router.delete('/:id', orderController.deleteOrder);
router.get('/:id/labels', orderController.generateLabels);

module.exports = router;
