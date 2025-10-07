// Plik server/routes/postcodeZoneRoutes.js
const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/postcodeZoneController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken, requireRole(['admin']));

router.get('/export', zoneController.exportZones);
router.post('/import', zoneController.importZones);
router.get('/', zoneController.getAllZones);
router.post('/', zoneController.createZone);
router.put('/:zoneId', zoneController.updateZone);
router.delete('/:zoneId', zoneController.deleteZone);

module.exports = router;