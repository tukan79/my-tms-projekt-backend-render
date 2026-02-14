const express = require('express');
const optimizationController = require('../controllers/optimizationController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post(
  '/ortools/solve',
  authenticateToken,
  requireRole(['admin', 'dispatcher']),
  optimizationController.solveOrTools
);

module.exports = router;
