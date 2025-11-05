// Plik: server/routes/feedbackRoutes.js
const express = require('express');
const feedbackController = require('../controllers/feedbackController.js');

const router = express.Router();

router.post('/report-bug', feedbackController.reportBug);

module.exports = router;