// server/controllers/driverController.js

const driverService = require('../services/driverService.js');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');

const allowedDriverFields = [
  'first_name',
  'last_name',
  'phone_number',
  'cpc_number',
  'login_code',
  'license_number',
  'is_active',
];

function extractDriverFields(body) {
  const data = {};
  for (const key of allowedDriverFields) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  return data;
}

exports.getAllDrivers = async (req, res, next) => {
  try {
    const drivers = await driverService.findDriversByCompany();
    res.status(200).json({ drivers: drivers || [] });
  } catch (error) {
    next(error);
  }
};

exports.exportDrivers = async (req, res, next) => {
  try {
    const drivers = await driverService.findDriversByCompany();
    const csv = Papa.unparse(drivers.map(d => d.get({ plain: true })));

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `drivers_${timestamp}.csv`;
    const exportsDir = path.join(__dirname, '../exports');

    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(exportsDir, filename), csv, 'utf8');

    res.status(200).json({ message: `File successfully exported as ${filename}` });
  } catch (error) {
    console.error('Failed to export drivers:', error);
    res.status(500).json({ error: 'Error exporting drivers.' });
  }
};

exports.importDrivers = async (req, res, next) => {
  try {
    const result = await driverService.importDrivers(req.body);
    res.status(201).json({ 
      message: `Successfully processed ${result.count} drivers.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

exports.createDriver = async (req, res, next) => {
  try {
    if (!req.body.first_name || !req.body.last_name) {
      return res.status(400).json({ error: 'Imię i nazwisko kierowcy są wymagane.' });
    }

    const payload = extractDriverFields(req.body);
    const newDriver = await driverService.createDriver(payload);

    res.status(201).json(newDriver);
  } catch (error) {
    next(error);
  }
};

exports.updateDriver = async (req, res, next) => {
  try {
    if (!req.body.first_name || !req.body.last_name || !req.body.license_number) {
      return res.status(400).json({ error: 'Imię, nazwisko i numer prawa jazdy są wymagane.' });
    }

    const payload = extractDriverFields(req.body);
    const updatedDriver = await driverService.updateDriver(req.params.driverId, payload);

    if (!updatedDriver) {
      return res.status(404).json({ error: 'Nie znaleziono kierowcy lub brak uprawnień.' });
    }

    res.json(updatedDriver);
  } catch (error) {
    next(error);
  }
};

exports.deleteDriver = async (req, res, next) => {
  try {
    const changes = await driverService.deleteDriver(req.params.driverId);

    if (changes === 0) {
      return res.status(404).json({ error: 'Nie znaleziono kierowcy lub brak uprawnień.' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
