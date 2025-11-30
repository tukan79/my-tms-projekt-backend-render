// server/controllers/trailerController.js
const trailerService = require('../services/trailerService.js');
const Papa = require('papaparse');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Standardized logging helper
 */
const logController = (level, context, message, data = null) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    context: `TrailerController.${context}`,
    message,
  };
  if (data) entry.data = data;
  console.log(JSON.stringify(entry, null, 2));
};

exports.getAllTrailers = async (req, res, next) => {
  const ctx = 'getAllTrailers';
  try {
    const trailers = await trailerService.findTrailersByCompany();
    res.json({ trailers: trailers || [] });
  } catch (error) {
    logController('ERROR', ctx, 'Failed to fetch trailers', { error: error.message });
    next(error);
  }
};

exports.exportTrailers = async (req, res, next) => {
  const ctx = 'exportTrailers';
  try {
    const trailers = await trailerService.findTrailersByCompany();
    const csv = Papa.unparse(trailers.map(t => t.get({ plain: true })));

    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const filename = `trailers_${timestamp}.csv`;
    const exportsDir = path.join(__dirname, '../exports');

    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

    const filePath = path.join(exportsDir, filename);
    fs.writeFileSync(filePath, csv, 'utf8');

    logController('INFO', ctx, 'Exported trailers to CSV', { filename });
    res.status(200).json({ message: `File successfully exported to server as ${filename}` });
  } catch (error) {
    logController('ERROR', ctx, 'Failed to export trailers', { error: error.message });
    res.status(500).json({ error: 'An error occurred while exporting trailers.' });
  }
};

const validateTrailerBody = (body) => {
  if (!body.registration_plate || !body.brand) {
    const error = new Error('Numer rejestracyjny i marka są wymagane.');
    error.status = 400;
    throw error;
  }
};

exports.createTrailer = async (req, res, next) => {
  const ctx = 'createTrailer';
  try {
    validateTrailerBody(req.body);

    const newTrailer = await trailerService.createTrailer(req.body);
    logController('INFO', ctx, 'Trailer created', { id: newTrailer.id });
    res.status(201).json(newTrailer);
  } catch (error) {
    logController('ERROR', ctx, 'Failed to create trailer', { error: error.message });
    next(error);
  }
};

exports.importTrailers = async (req, res, next) => {
  const ctx = 'importTrailers';
  try {
    const result = await trailerService.importTrailers(req.body.trailers || req.body);
    logController('INFO', ctx, 'Trailers imported', { importedCount: result.importedCount });
    res.status(201).json({ message: `${result.importedCount} trailers imported successfully.`, ...result });
  } catch (error) {
    logController('ERROR', ctx, 'Failed to import trailers', { error: error.message });
    next(error);
  }
};

exports.updateTrailer = async (req, res, next) => {
  const ctx = 'updateTrailer';
  try {
    const { id } = req.params;
    validateTrailerBody(req.body);

    const updatedTrailer = await trailerService.updateTrailer(id, req.body);
    if (!updatedTrailer) {
      return res.status(404).json({ error: 'Nie znaleziono naczepy lub brak uprawnień.' });
    }

    logController('INFO', ctx, 'Trailer updated', { id });
    res.json(updatedTrailer);
  } catch (error) {
    logController('ERROR', ctx, 'Failed to update trailer', { error: error.message });
    next(error);
  }
};

exports.deleteTrailer = async (req, res, next) => {
  const ctx = 'deleteTrailer';
  try {
    const trailerId = req.params.trailerId || req.params.id;
    const changes = await trailerService.deleteTrailer(trailerId);

    if (changes === 0) {
      return res.status(404).json({ error: 'Nie znaleziono naczepy lub brak uprawnień.' });
    }

    logController('INFO', ctx, 'Trailer deleted', { trailerId });
    res.status(204).send();
  } catch (error) {
    logController('ERROR', ctx, 'Failed to delete trailer', { error: error.message });
    next(error);
  }
};
