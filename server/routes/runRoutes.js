// Plik server/routes/runRoutes.js
const express = require('express');
const router = express.Router();
const runController = require('../controllers/runController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { validateRun } = require('../middleware/validationMiddleware.js');

router.use(authenticateToken, requireRole(['admin', 'dispatcher']));

router.get('/', runController.getAllRuns);
router.post('/', validateRun, runController.createRun);
router.delete('/:id', runController.deleteRun);
router.get('/:id/manifest', runController.generateManifest);
router.put('/:id', validateRun, runController.updateRun); // Zmieniamy na :id dla spójności z kontrolerem
router.patch('/:id/status', runController.updateStatus); // Zmieniamy na :id dla spójności z kontrolerem

module.exports = router;