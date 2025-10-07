// Plik server/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const orderController = require('../controllers/orderController');

// Wszystkie trasy dla zleceń wymagają autentykacji
router.use(authenticateToken, requireRole(['admin', 'dispatcher']));

router.get('/', orderController.getAllOrders);
router.post('/', orderController.createOrder);
router.put('/:orderId', orderController.updateOrder);
router.delete('/:orderId', orderController.deleteOrder);
router.post('/import', orderController.importOrders); // Nowa trasa do importu

module.exports = router;
