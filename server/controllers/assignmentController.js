const assignmentService = require('../services/assignmentService.js');

exports.getAllAssignments = async (req, res, next) => {
  try {
    const assignments = await assignmentService.findAllAssignments();
    res.json({ assignments: assignments || [] });
  } catch (error) {
    next(error);
  }
};

exports.createAssignment = async (req, res, next) => {
  try {
    const { order_id, run_id, notes } = req.body;

    if (order_id == null || run_id == null) {
      return res.status(400).json({ error: 'Order ID and Run ID are required.' });
    }

    const parsedOrderId = Number.parseInt(order_id, 10);
    const parsedRunId = Number.parseInt(run_id, 10);

    if (Number.isNaN(parsedOrderId) || Number.isNaN(parsedRunId)) {
      return res.status(400).json({ error: 'Order ID and Run ID must be valid numbers.' });
    }

    const newAssignment = await assignmentService.createAssignment({
      order_id: parsedOrderId,
      run_id: parsedRunId,
      notes,
    });

    res.status(201).json(newAssignment);
  } catch (error) {
    next(error);
  }
};

exports.deleteAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsedId = Number.parseInt(id, 10);

    if (Number.isNaN(parsedId)) {
      return res.status(400).json({ error: 'Assignment ID must be a valid number.' });
    }

    const changes = await assignmentService.deleteAssignment(parsedId);
    if (changes === 0) {
      return res
        .status(404)
        .json({ error: 'Assignment not found or you do not have permission to delete it.' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

exports.bulkCreateAssignments = async (req, res, next) => {
  try {
    const { run_id, order_ids } = req.body;

    if (run_id == null || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ error: 'Run ID and a non-empty array of order IDs are required.' });
    }

    const parsedRunId = Number.parseInt(run_id, 10);
    if (Number.isNaN(parsedRunId)) {
      return res.status(400).json({ error: 'Run ID must be a valid number.' });
    }

    const parsedOrderIds = order_ids.map(id => Number.parseInt(id, 10));
    if (parsedOrderIds.some(Number.isNaN)) {
      return res.status(400).json({ error: 'All order IDs in the array must be valid numbers.' });
    }

    const result = await assignmentService.bulkCreateAssignments(parsedRunId, parsedOrderIds);

    res.status(201).json({
      message: `${result.createdCount} assignments created/updated successfully.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
