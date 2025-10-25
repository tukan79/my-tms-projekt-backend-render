// Plik: server/routes/feedbackRoutes.js
const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController.js');
const { authenticateToken } = require('../middleware/authMiddleware');

// Wszystkie trasy w tym pliku wymagają zalogowanego użytkownika
router.use(authenticateToken);

router.post('/report-bug', feedbackController.reportBug);

module.exports = router;