// Plik server/routes/trailerRoutes.js
const express = require('express');
const router = express.Router();
const trailerController = require('../controllers/trailerController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken, requireRole(['admin']));

router.get('/', trailerController.getAllTrailers);
router.get('/export', trailerController.exportTrailers);
router.post('/import', trailerController.importTrailers);
router.post('/', trailerController.createTrailer);
router.put('/:trailerId', trailerController.updateTrailer);
router.delete('/:trailerId', trailerController.deleteTrailer);

module.exports = router;