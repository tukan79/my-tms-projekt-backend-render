// server/routes/assignmentRoutes.js
const express = require('express');
const assignmentController = require('../controllers/assignmentController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get(
  '/',
  authenticateToken,
  requireRole(['admin', 'dispatcher']),
  assignmentController.getAllAssignments
);

router.post(
  '/',
  authenticateToken,
  requireRole(['admin', 'dispatcher']),
  assignmentController.createAssignment
);

// ⚡ Zmieniamy param na :assignmentId, żeby pasowało do kontrolera
router.delete(
  '/:assignmentId',
  authenticateToken,
  requireRole(['admin', 'dispatcher']),
  assignmentController.deleteAssignment
);

router.post(
  '/bulk',
  authenticateToken,
  requireRole(['admin', 'dispatcher']),
  assignmentController.bulkCreateAssignments
);

module.exports = router;
