// Plik: server/controllers/assignmentController.js
const assignmentService = require('../services/assignmentService.js');

// Pobierz wszystkie przypisania
const getAllAssignments = async (req, res, next) => {
  try {
    const assignments = await assignmentService.findAllAssignments();
    res.status(200).json({ assignments: assignments || [] });
  } catch (error) {
    next(error);
  }
};

// Utwórz pojedyncze przypisanie
const createAssignment = async (req, res, next) => {
  try {
    const { orderId, runId, notes } = req.body;

    if (!orderId || !runId) {
      return res.status(400).json({ error: 'orderId i runId są wymagane.' });
    }

    const newAssignment = await assignmentService.createAssignment({ orderId, runId, notes });
    res.status(201).json(newAssignment);
  } catch (error) {
    next(error);
  }
};

// Usuń przypisanie po ID
const deleteAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;

    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId jest wymagane.' });
    }

    const deletedCount = await assignmentService.deleteAssignment(assignmentId);

    if (deletedCount === 0) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Utwórz przypisania masowo
const bulkCreateAssignments = async (req, res, next) => {
  try {
    const { runId, orderIds } = req.body;

    if (!runId || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'runId i niepusta lista orderIds są wymagane.' });
    }

    const result = await assignmentService.bulkCreateAssignments(runId, orderIds);

    res.status(201).json({
      message: `${result.createdCount} assignments created successfully.`,
      ...result
    });
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
