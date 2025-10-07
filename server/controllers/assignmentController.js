// Plik server/controllers/assignmentController.js
const assignmentService = require('../services/assignmentService');

exports.getAllAssignments = async (req, res, next) => {
  try {
    const assignments = await assignmentService.findAllAssignments();
    res.json(assignments);
  } catch (error) {
    next(error);
  }
};

exports.createAssignment = async (req, res, next) => {
  try {
    const { order_id, run_id, notes } = req.body;

    if (!order_id || !run_id) {
      return res.status(400).json({ error: 'Order ID and Run ID are required.' });
    }

    const newAssignment = await assignmentService.createAssignment({ 
      order_id: parseInt(order_id, 10), 
      run_id: parseInt(run_id, 10), 
      notes,
    });
    res.status(201).json(newAssignment);
  } catch (error) {
    next(error);
  }
};

exports.deleteAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const changes = await assignmentService.deleteAssignment(assignmentId);
    if (changes === 0) {
      return res.status(404).json({ error: 'Assignment not found or you do not have permission to delete it.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};