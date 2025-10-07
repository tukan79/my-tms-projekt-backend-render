// Plik server/routes/truckRoutes.js
const express = require('express');
const router = express.Router();
const truckController = require('../controllers/truckController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken, requireRole(['admin']));

router.get('/', truckController.getAllTrucks);
router.get('/export', truckController.exportTrucks);
router.post('/import', truckController.importTrucks); // Add the import route
router.post('/', truckController.createTruck);
router.put('/:truckId', truckController.updateTruck);
router.delete('/:truckId', truckController.deleteTruck);

module.exports = router;