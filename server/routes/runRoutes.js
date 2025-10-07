// Plik server/routes/runRoutes.js
const express = require('express');
const router = express.Router();
const runController = require('../controllers/runController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken, requireRole(['admin', 'dispatcher']));

router.get('/', runController.getAllRuns);
router.post('/', runController.createRun);
router.delete('/:runId', runController.deleteRun);

module.exports = router;