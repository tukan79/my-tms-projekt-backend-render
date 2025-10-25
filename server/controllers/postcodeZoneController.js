// Plik server/controllers/postcodeZoneController.js
const zoneService = require('../services/postcodeZoneService.js'); // Poprawiony import
const Papa = require('papaparse');
const fs = require('fs'); // Moduł do operacji na plikach
const path = require('path');

exports.getAllZones = async (req, res, next) => {
  try {
    const zones = await zoneService.findAllZones();
    res.json(zones);
  } catch (error) {
    next(error);
  }
};

exports.createZone = async (req, res, next) => {
  try {
    if (!req.body.zone_name) {
      return res.status(400).json({ error: 'Zone name is required.' });
    }
    const newZone = await zoneService.createZone(req.body);
    res.status(201).json(newZone);
  } catch (error) {
    next(error);
  }
};

exports.updateZone = async (req, res, next) => {
  try {
    const updatedZone = await zoneService.updateZone(req.params.zoneId, req.body);
    if (!updatedZone) {
      return res.status(404).json({ error: 'Zone not found.' });
    }
    res.json(updatedZone);
  } catch (error) {
    next(error);
  }
};

exports.deleteZone = async (req, res, next) => {
  try {
    const changes = await zoneService.deleteZone(req.params.zoneId);
    if (changes === 0) {
      return res.status(404).json({ error: 'Zone not found.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

exports.exportZones = async (req, res, next) => {
  try {
    console.log('[Export] 1/6: Starting export process...');
    const zones = await zoneService.findAllZones();
    console.log(`[Export] 2/6: Successfully fetched ${zones.length} zones from the database.`);

    // Konwertujemy tablicę wzorców na string oddzielony średnikami
    const dataToExport = zones.map(zone => ({
      ...zone,
      postcode_patterns: (zone.postcode_patterns || []).join(';'),
    }));

    const csv = Papa.unparse(dataToExport);
    console.log('[Export] 3/6: Successfully converted data to CSV format.');

    // Generowanie unikalnej nazwy pliku z datą i czasem
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `postcode_zones_${timestamp}.csv`;

    // Definiowanie ścieżki do katalogu 'exports'
    const exportsDir = path.join(__dirname, '../exports');
    console.log(`[Export] 4/6: Target directory is: ${exportsDir}`);

    // Upewniamy się, że katalog istnieje
    if (!fs.existsSync(exportsDir)) {
      console.log('[Export] Directory does not exist, creating it...');
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Zapis pliku na serwerze
    const filePath = path.join(exportsDir, filename);
    fs.writeFileSync(filePath, csv, 'utf8');
    console.log(`[Export] 5/6: Successfully wrote file to: ${filePath}`);

    // Wysłanie odpowiedzi JSON z potwierdzeniem
    res.status(200).json({ message: `File successfully exported to server as ${filename}` });
    console.log('[Export] 6/6: Sent success response to client.');
  } catch (error) {
    console.error('Failed to export zones:', error);
    // Zapewniamy, że odpowiedź błędu jest wysyłana jako tekst, co jest bezpieczniejsze, gdy frontend oczekuje 'blob'.
    res.status(500).send('An error occurred while exporting the data.');
  }
};

exports.importZones = async (req, res, next) => {
  try {
    // Oczekujemy, że dane będą w obiekcie pod kluczem zdefiniowanym w `postDataKey`
    const zonesData = req.body.zones || req.body;
    if (!Array.isArray(zonesData)) {
      return res.status(400).json({ error: 'Invalid data format. Expected an array of zones.' });
    }
    const result = await zoneService.importZones(zonesData);
    res.status(201).json({ message: `Successfully imported ${result.count} zones.`, ...result });
  } catch (error) {
    next(error);
  }
};

exports.seedZones = async (req, res, next) => {
  // Ta funkcja powinna być dostępna tylko w środowisku deweloperskim
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This feature is only available in development mode.' });
  }

  try {
    const filePath = path.join(__dirname, '../seed_data/postcode_zones.csv');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Seed file not found.' });
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parseResult = Papa.parse(fileContent, { header: true, skipEmptyLines: true });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({ error: 'Error parsing seed file.', details: parseResult.errors });
    }

    const result = await zoneService.importZones(parseResult.data);
    res.status(201).json({ message: `Successfully seeded ${result.count} zones from file.`, ...result });
  } catch (error) {
    next(error);
  }
};