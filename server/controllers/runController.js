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
    const newRun = await runService.createRun(req.body);
    res.status(201).json(newRun);
  } catch (error) {
    next(error);
  }
};

exports.deleteRun = async (req, res, next) => {
  try {
    const { runId } = req.params;
    console.log(`[runController] Otrzymano żądanie usunięcia przejazdu o ID: ${runId}`);
    const changes = await runService.deleteRun(runId);
    if (changes === 0) {
      console.warn(`[runController] Nie znaleziono przejazdu o ID: ${runId} do usunięcia.`);
      return res.status(404).json({ error: 'Run not found.' });
    }
    console.log(`[runController] Pomyślnie usunięto przejazd o ID: ${runId}.`);
    res.status(204).send(); // 204 No Content - standardowa odpowiedź dla udanego usunięcia
  } catch (error) {
    next(error);
  }
};