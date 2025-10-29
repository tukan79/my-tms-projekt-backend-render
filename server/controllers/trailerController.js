// Plik server/controllers/trailerController.js
const trailerService = require('../services/trailerService.js'); // Użyjemy serwisu
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');

exports.getAllTrailers = async (req, res, next) => {
  try {
    const trailers = await trailerService.findTrailersByCompany();
    res.json(trailers);
  } catch (error) {
    next(error);
  }
};

exports.exportTrailers = async (req, res, next) => {
  try {
    const trailers = await trailerService.findTrailersByCompany();
    const csv = Papa.unparse(trailers.map(t => t.get({ plain: true }))); // Używamy get({ plain: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
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
    const newTrailer = await trailerService.createTrailer({
      registrationPlate: trailerData.registration_plate,
      brand: trailerData.brand,
      description: trailerData.description,
      category: trailerData.category,
      maxPayloadKg: trailerData.max_payload_kg,
      maxSpaces: trailerData.max_spaces,
      lengthM: trailerData.length_m,
      widthM: trailerData.width_m,
      heightM: trailerData.height_m,
      weightKg: trailerData.weight_kg,
      status: trailerData.status,
    });
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
    const updatedTrailer = await trailerService.updateTrailer(trailerId, {
      registrationPlate: req.body.registration_plate,
      brand: req.body.brand,
      description: req.body.description,
      category: req.body.category,
      maxPayloadKg: req.body.max_payload_kg,
      maxSpaces: req.body.max_spaces,
      lengthM: req.body.length_m,
      widthM: req.body.width_m,
      heightM: req.body.height_m,
      weightKg: req.body.weight_kg,
      status: req.body.status,
    });

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