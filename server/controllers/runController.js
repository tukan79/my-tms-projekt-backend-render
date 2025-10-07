// Plik server/controllers/runController.js
const runService = require('../services/runService.js');

exports.getAllRuns = async (req, res, next) => {
  try {
    const runs = await runService.findAllRuns();
    res.json(runs);
  } catch (error) {
    next(error);
  }
};

exports.createRun = async (req, res, next) => {
  try {
    const { run_date, type, driver_id, truck_id } = req.body;
    if (!run_date || !type || !driver_id || !truck_id) {
      return res.status(400).json({ error: 'Run date, type, driver, and truck are required.' });
    }
    const newRun = await runService.createRun(req.body);
    res.status(201).json(newRun);
  } catch (error) {
    next(error);
  }
};

exports.deleteRun = async (req, res, next) => {
  try {
    const changes = await runService.deleteRun(req.params.runId);
    if (changes === 0) {
      return res.status(404).json({ error: 'Run not found.' });
    }
    res.status(204).send();
  } catch (error) {
    // Przekazujemy błąd do errorMiddleware, który obsłuży specyficzny komunikat
    if (error.message.includes('Cannot delete a run')) {
      error.status = 409; // Conflict
    }
    next(error);
  }
};