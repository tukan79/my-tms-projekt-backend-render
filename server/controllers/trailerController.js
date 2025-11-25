// Plik server/controllers/trailerController.js
const trailerService = require('../services/trailerService.js'); // Użyjemy serwisu
const Papa = require('papaparse');
const fs = require('node:fs');
const path = require('node:path');

exports.getAllTrailers = async (req, res, next) => {
  try {
    const trailers = await trailerService.findTrailersByCompany();
    res.json({ trailers: trailers || [] });
  } catch (error) {
    next(error);
  }
};

exports.exportTrailers = async (req, res, next) => {
  try {
    const trailers = await trailerService.findTrailersByCompany();
    const csv = Papa.unparse(trailers.map(t => t.get({ plain: true }))); // Używamy get({ plain: true })

    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const filename = `trailers_${timestamp}.csv`;
    const exportsDir = path.join(__dirname, '../exports');

    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const filePath = path.join(exportsDir, filename);
    fs.writeFileSync(filePath, csv, 'utf8');

    res.status(200).json({ message: `File successfully exported to server as ${filename}` });
  } catch (error) {
    console.error('Failed to export trailers:', error);
    res.status(500).json({ error: 'An error occurred while exporting trailers.' });
  }
};

exports.createTrailer = async (req, res, next) => {
  try {
    const trailerData = req.body;
    if (!trailerData.registration_plate || !trailerData.brand) {
      return res.status(400).json({ error: 'Numer rejestracyjny i marka są wymagane.' });
    }
    
    // Mapujemy snake_case z req.body na camelCase dla serwisu
    const newTrailer = await trailerService.createTrailer(req.body);
    res.status(201).json(newTrailer);
  } catch (error) {
    next(error);
  }
};

exports.importTrailers = async (req, res, next) => {
  try {
    const { trailers } = req.body;
    if (!trailers || !Array.isArray(trailers)) {
      return res.status(400).json({ error: 'Invalid data format. "trailers" array is required.' });
    }

    const result = await trailerService.importTrailers(trailers);
    res.status(201).json({ message: `${result.importedCount} trailers imported successfully.`, ...result });
  } catch (error) {
    console.error('Failed to import trailers:', error);
    next(error);
  }
};

exports.updateTrailer = async (req, res, next) => {
  try {
    const { trailerId } = req.params;

    if (!req.body.registration_plate || !req.body.brand) {
      return res.status(400).json({ error: 'Numer rejestracyjny i marka są wymagane.' });
    }
    
    // Mapujemy snake_case z req.body na camelCase dla serwisu
    const updatedTrailer = await trailerService.updateTrailer(trailerId, req.body);

    if (!updatedTrailer) {
      return res.status(404).json({ error: 'Nie znaleziono naczepy lub nie masz uprawnień do jej edycji.' });
    }

    res.json(updatedTrailer);
  } catch (error) {
    next(error);
  }
};

exports.deleteTrailer = async (req, res, next) => {
  try {
    const { trailerId } = req.params;
    const changes = await trailerService.deleteTrailer(trailerId);
    if (changes === 0) {
      return res.status(404).json({ error: 'Nie znaleziono naczepy lub nie masz uprawnień do jej usunięcia.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
//newcommit