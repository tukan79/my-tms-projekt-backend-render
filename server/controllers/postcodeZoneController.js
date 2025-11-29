// Plik: server/controllers/postcodeZoneController.js
const zoneService = require('../services/postcodeZoneService.js');
const Papa = require('papaparse');
const fs = require('node:fs');
const path = require('node:path');

/* ============================================================================
   GET ALL ZONES
============================================================================ */
exports.getAllZones = async (req, res, next) => {
  try {
    const zones = await zoneService.findAllZones();
    res.json({ zones: zones || [] });
  } catch (error) {
    next(error);
  }
};

/* ============================================================================
   CREATE ZONE
============================================================================ */
exports.createZone = async (req, res, next) => {
  try {
    const { zone_name, postcode_patterns, is_home_zone } = req.body;

    if (!zone_name) {
      return res.status(400).json({ error: 'Zone name is required.' });
    }

    const newZone = await zoneService.createZone({
      zone_name,
      postcode_patterns,
      is_home_zone,
    });

    res.status(201).json(newZone);
  } catch (error) {
    next(error);
  }
};

/* ============================================================================
   UPDATE ZONE
============================================================================ */
exports.updateZone = async (req, res, next) => {
  try {
    const { zoneId } = req.params;
    const { zone_name, postcode_patterns, is_home_zone } = req.body;

    const updatedZone = await zoneService.updateZone(zoneId, {
      zone_name,
      postcode_patterns,
      is_home_zone,
    });

    if (!updatedZone) {
      return res.status(404).json({ error: 'Zone not found.' });
    }

    res.json(updatedZone);
  } catch (error) {
    next(error);
  }
};

/* ============================================================================
   DELETE ZONE
============================================================================ */
exports.deleteZone = async (req, res, next) => {
  try {
    const { zoneId } = req.params;
    const deletedCount = await zoneService.deleteZone(zoneId);

    if (deletedCount === 0) {
      // Idempotent delete: return 204 even if nothing was removed
      return res.status(204).json({ message: 'Zone already deleted or not found.' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/* ============================================================================
   EXPORT ZONES TO CSV
============================================================================ */
exports.exportZones = async (req, res, next) => {
  try {
    const zones = await zoneService.findAllZones();

    // Zamiana tablicy wzorców na string oddzielony ;
    const dataToExport = zones.map(zone => ({
      ...zone,
      postcode_patterns: (zone.postcode_patterns || []).join(';'),
    }));

    const csv = Papa.unparse(dataToExport);

    // Unikalna nazwa pliku
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const filename = `postcode_zones_${timestamp}.csv`;

    // Katalog exports
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const filePath = path.join(exportsDir, filename);
    fs.writeFileSync(filePath, csv, 'utf8');

    return res.status(200).json({
      message: `File successfully exported to server as ${filename}`,
    });
  } catch (error) {
    console.error('Failed to export zones:', error);
    res.status(500).send('An error occurred while exporting the data.');
  }
};

/* ============================================================================
   IMPORT ZONES (from parsed JSON array)
============================================================================ */
exports.importZones = async (req, res, next) => {
  try {
    const zonesData = req.body.zones || req.body;

    if (!Array.isArray(zonesData)) {
      return res.status(400).json({ error: 'Invalid data format. Expected an array of zones.' });
    }

    const result = await zoneService.importZones(zonesData);

    res.status(201).json({
      message: `Successfully imported ${result.count} zones.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/* ============================================================================
   SEED ZONES (dev only)
============================================================================ */
exports.seedZones = async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'This feature is only available in development mode.',
    });
  }

  try {
    const filePath = path.join(__dirname, '../seed_data/postcode_zones.csv');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Seed file not found.' });
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });

    if (parsed.errors.length > 0) {
      return res.status(400).json({
        error: 'Error parsing seed file.',
        details: parsed.errors,
      });
    }

    const result = await zoneService.importZones(parsed.data);

    res.status(201).json({
      message: `Successfully seeded ${result.count} zones from file.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
