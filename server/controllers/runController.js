// server/controllers/runController.js

const runService = require('../services/runService.js');
const manifestService = require('../services/manifestService.js');

/**
 * Standardized logging for controller
 */
const log = (level, ctx, message, data = null) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    context: `runController.${ctx}`,
    message,
  };
  if (data) entry.data = data;
  console.log(JSON.stringify(entry));
};

/**
 * GET /runs
 * Retrieves all runs with optional filters.
 */
exports.getAllRuns = async (req, res, next) => {
  const ctx = 'getAllRuns';
  try {
    log('INFO', ctx, 'Fetching runs', { filters: req.query });

    const runs = await runService.findAllRuns(req.query);

    return res.json({ runs: runs || [] });
  } catch (error) {
    log('ERROR', ctx, 'Error fetching runs', { error: error.message });
    next(error);
  }
};

/**
 * GET /runs/:id/manifest
 * Generates a PDF manifest for a specific run.
 */
exports.generateManifest = async (req, res, next) => {
  const ctx = 'generateManifest';
  try {
    const { id } = req.params;
    log('INFO', ctx, 'Manifest requested', { runId: id });

    const pdfBuffer = await manifestService.generateRunManifestPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="manifest_run_${id}.pdf"`
    );

    return res.send(pdfBuffer);
  } catch (error) {
    log('ERROR', ctx, 'Error generating manifest', { error: error.message });
    next(error);
  }
};

/**
 * POST /runs
 * Creates a new run.
 */
exports.createRun = async (req, res, next) => {
  const ctx = 'createRun';
  try {
    const payload = {
      run_date: req.body.run_date,
      type: req.body.type,
      truck_id: req.body.truck_id,
      trailer_id: req.body.trailer_id,
      driver_id: req.body.driver_id,
    };

    log('INFO', ctx, 'Creating run', payload);

    const newRun = await runService.createRun(payload);

    return res.status(201).json(newRun);
  } catch (error) {
    log('ERROR', ctx, 'Error creating run', { error: error.message });
    next(error);
  }
};

/**
 * DELETE /runs/:id
 * Permanently deletes a run by ID.
 */
exports.deleteRun = async (req, res, next) => {
  const ctx = 'deleteRun';
  try {
    const { id } = req.params;
    log('INFO', ctx, 'Deleting run', { runId: id });

    const deleted = await runService.deleteRun(id);

    if (deleted === 0) {
      log('WARN', ctx, 'Run not found', { runId: id });
      return res.status(404).json({ error: 'Run not found.' });
    }

    log('INFO', ctx, 'Run deleted successfully', { runId: id });
    return res.status(204).send();
  } catch (error) {
    log('ERROR', ctx, 'Error deleting run', { error: error.message });
    next(error);
  }
};

/**
 * PATCH /runs/:id/status
 * Updates run status only.
 */
exports.updateStatus = async (req, res, next) => {
  const ctx = 'updateStatus';
  try {
    const { id } = req.params;
    const { status } = req.body;

    log('INFO', ctx, 'Updating status', { runId: id, status });

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const updatedRun = await runService.updateRunStatus(id, status);

    if (!updatedRun) {
      log('WARN', ctx, 'Run not found', { runId: id });
      return res.status(404).json({ error: 'Run not found.' });
    }

    return res.json(updatedRun);
  } catch (error) {
    log('ERROR', ctx, 'Error updating status', { error: error.message });
    next(error);
  }
};

/**
 * PUT /runs/:id
 * Updates run metadata.
 */
exports.updateRun = async (req, res, next) => {
  const ctx = 'updateRun';
  try {
    const { id } = req.params;

    const payload = {
      run_date: req.body.run_date,
      type: req.body.type,
      truck_id: req.body.truck_id,
      trailer_id: req.body.trailer_id,
      driver_id: req.body.driver_id,
    };

    log('INFO', ctx, 'Updating run', { runId: id, payload });

    const updatedRun = await runService.updateRun(id, payload);

    if (!updatedRun) {
      log('WARN', ctx, 'Run not found or deleted', { runId: id });
      return res.status(404).json({ error: 'Run not found or already deleted.' });
    }

    return res.status(200).json(updatedRun);
  } catch (error) {
    log('ERROR', ctx, 'Error updating run', { error: error.message });
    next(error);
  }
};
