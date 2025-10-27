// Plik server/routes/assignmentRoutes.js
const express = require('express');
const assignmentController = require('../controllers/assignmentController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware.js');

const router = express.Router();
router.get('/', authenticateToken, requireRole(['admin', 'dispatcher']), assignmentController.getAllAssignments);
router.post('/', authenticateToken, requireRole(['admin', 'dispatcher']), assignmentController.createAssignment);
router.delete('/:id', authenticateToken, requireRole(['admin', 'dispatcher']), assignmentController.deleteAssignment); // Changed from :assignmentId to :id
router.post('/bulk', authenticateToken, requireRole(['admin', 'dispatcher']), assignmentController.bulkCreateAssignments);

module.exports = router;