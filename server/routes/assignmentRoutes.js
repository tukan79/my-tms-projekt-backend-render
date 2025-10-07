// Plik server/routes/assignmentRoutes.js
const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Wszystkie trasy w tym pliku są chronione i wymagają uwierzytelnienia oraz uprawnień admina
router.use(authenticateToken, requireRole(['admin', 'dispatcher']));

router.get('/', assignmentController.getAllAssignments);
router.post('/', assignmentController.createAssignment);
router.delete('/:assignmentId', assignmentController.deleteAssignment);

module.exports = router;