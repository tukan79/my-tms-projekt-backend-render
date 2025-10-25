// Plik server/routes/assignmentRoutes.js
const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, requireRole(['admin', 'dispatcher']), assignmentController.getAllAssignments);
router.post('/', authenticateToken, requireRole(['admin', 'dispatcher']), assignmentController.createAssignment);
router.delete('/:id', authenticateToken, requireRole(['admin', 'dispatcher']), assignmentController.deleteAssignment); // Changed from :assignmentId to :id
router.post('/bulk', authenticateToken, requireRole(['admin', 'dispatcher']), assignmentController.bulkCreateAssignments);

module.exports = router;