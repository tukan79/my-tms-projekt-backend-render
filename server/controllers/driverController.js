// Plik server/controllers/driverController.js
const driverService = require('../services/driverService.js');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');


exports.getAllDrivers = async (req, res, next) => {
  try {
    const drivers = await driverService.findDriversByCompany(); 
    res.status(200).json(drivers);
  } catch (error) {
    next(error);
  }
};

exports.exportDrivers = async (req, res, next) => {
  try {
    const drivers = await driverService.findDriversByCompany();
    const csv = Papa.unparse(drivers.map(d => d.get({ plain: true }))); // Używamy get({ plain: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `drivers_${timestamp}.csv`;
    const exportsDir = path.join(__dirname, '../exports');

    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const filePath = path.join(exportsDir, filename);
    fs.writeFileSync(filePath, csv, 'utf8');

    res.status(200).json({ message: `File successfully exported to server as ${filename}` });
  } catch (error) {
    console.error('Failed to export drivers:', error);
    res.status(500).json({ error: 'An error occurred while exporting drivers.' });
  }
};

exports.importDrivers = async (req, res, next) => {
  try {
    const result = await driverService.importDrivers(req.body);
    res.status(201).json({ message: `Successfully processed ${result.count} drivers.`, ...result });
  } catch (error) {
    next(error);
  }
};

exports.createDriver = async (req, res, next) => {
  try {
    // Prosta walidacja - można ją rozbudować
    if (!req.body.first_name || !req.body.last_name) {
      return res.status(400).json({ error: 'Imię i nazwisko kierowcy są wymagane.' });
    }
    // Mapujemy snake_case z req.body na camelCase dla serwisu
    const newDriver = await driverService.createDriver({
      firstName: req.body.first_name,
      lastName: req.body.last_name,
      phoneNumber: req.body.phone_number,
      cpcNumber: req.body.cpc_number,
      loginCode: req.body.login_code,
      licenseNumber: req.body.license_number,
      isActive: req.body.is_active,
    });
    res.status(201).json(newDriver);
  } catch (error) {
    next(error);
  }
};

exports.updateDriver = async (req, res, next) => {
  try {
    const { driverId } = req.params;

    // Prosta walidacja
    if (!req.body.first_name || !req.body.last_name || !req.body.license_number) {
      return res.status(400).json({ error: 'Imię, nazwisko i numer prawa jazdy są wymagane.' });
    }

    // Mapujemy snake_case z req.body na camelCase dla serwisu
    const updatedDriver = await driverService.updateDriver(driverId, {
      firstName: req.body.first_name,
      lastName: req.body.last_name,
      phoneNumber: req.body.phone_number,
      cpcNumber: req.body.cpc_number,
      loginCode: req.body.login_code,
      licenseNumber: req.body.license_number,
      isActive: req.body.is_active,
    });

    if (!updatedDriver) {
      return res.status(404).json({ error: 'Nie znaleziono kierowcy lub nie masz uprawnień do jego edycji.' });
    }

    res.json(updatedDriver);
  } catch (error) {
    next(error);
  }
};

exports.deleteDriver = async (req, res, next) => {
  try {
    const { driverId } = req.params;

    const changes = await driverService.deleteDriver(driverId);

    if (changes === 0) {
      return res.status(404).json({ error: 'Nie znaleziono kierowcy lub nie masz uprawnień do jego usunięcia.' });
    }

    res.status(204).send(); // 204 No Content
  } catch (error) {
    next(error);
  }
};