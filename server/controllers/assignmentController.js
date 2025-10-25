// Plik server/controllers/assignmentController.js
const assignmentService = require('../services/assignmentService');

const getAllAssignments = async (req, res, next) => {
  try {
    const assignments = await assignmentService.findAllAssignments(); // Changed from findAssignments
    res.json(assignments);
  } catch (error) {
    next(error);
  }
};

const createAssignment = async (req, res, next) => {
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

const deleteAssignment = async (req, res, next) => {
  try {
    const { id } = req.params; // Changed from assignmentId to id to match route
    const changes = await assignmentService.deleteAssignment(id);
    if (changes === 0) {
      return res.status(404).json({ error: 'Assignment not found or you do not have permission to delete it.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const bulkCreateAssignments = async (req, res, next) => {
  try {
    const { run_id, order_ids } = req.body;
    if (!run_id || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ error: 'Run ID and a non-empty array of order IDs are required.' });
    }
    const result = await assignmentService.bulkCreateAssignments(run_id, order_ids);
    res.status(201).json({ message: `${result.createdCount} assignments created/updated successfully.`, ...result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAssignments,
  createAssignment,
  deleteAssignment,
  bulkCreateAssignments,
};