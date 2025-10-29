// Plik server/controllers/truckController.js
const truckService = require('../services/truckService.js'); // Użyjemy serwisu
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');

exports.getAllTrucks = async (req, res, next) => {
  try {
    const trucks = await truckService.findTrucksByCompany();
    res.json(trucks);
  } catch (error) {
    next(error);
  }
};

exports.exportTrucks = async (req, res, next) => {
  try {
    const trucks = await truckService.findTrucksByCompany();
    const csv = Papa.unparse(trucks.map(t => t.get({ plain: true }))); // Używamy get({ plain: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `trucks_${timestamp}.csv`;
    const exportsDir = path.join(__dirname, '../exports');

    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const filePath = path.join(exportsDir, filename);
    fs.writeFileSync(filePath, csv, 'utf8');

    res.status(200).json({ message: `File successfully exported to server as ${filename}` });
  } catch (error) {
    console.error('Failed to export trucks:', error);
    res.status(500).json({ error: 'An error occurred while exporting trucks.' });
  }
};

exports.createTruck = async (req, res, next) => {
  try {
    const truckData = req.body;
    if (!truckData.registration_plate || !truckData.brand) {
      return res.status(400).json({ error: 'Numer rejestracyjny, marka i model są wymagane.' });
    }
    
    // Mapujemy snake_case z req.body na camelCase dla serwisu
    const newTruck = await truckService.createTruck({
      registrationPlate: truckData.registration_plate,
      brand: truckData.brand,
      model: truckData.model,
      vin: truckData.vin,
      productionYear: truckData.production_year,
      typeOfTruck: truckData.type_of_truck,
      totalWeight: truckData.total_weight,
      palletCapacity: truckData.pallet_capacity,
      maxPayloadKg: truckData.max_payload_kg,
      isActive: truckData.is_active,
    });
    res.status(201).json(newTruck);
  } catch (error) {
    next(error);
  }
};

exports.importTrucks = async (req, res, next) => {
  try {
    const { trucks } = req.body;
    if (!trucks || !Array.isArray(trucks)) {
      return res.status(400).json({ error: 'Invalid data format. "trucks" array is required.' });
    }

    const result = await truckService.importTrucks(trucks);
    res.status(201).json({ message: `${result.importedCount} trucks imported successfully.`, ...result });
  } catch (error) {
    console.error('Failed to import trucks:', error);
    next(error);
  }
};

exports.updateTruck = async (req, res, next) => {
  try {
    const { truckId } = req.params;

    if (!req.body.registration_plate || !req.body.brand) {
      return res.status(400).json({ error: 'Numer rejestracyjny i marka są wymagane.' });
    }
    
    // Mapujemy snake_case z req.body na camelCase dla serwisu
    const updatedTruck = await truckService.updateTruck(truckId, {
      registrationPlate: req.body.registration_plate,
      brand: req.body.brand,
      model: req.body.model,
      vin: req.body.vin,
      productionYear: req.body.production_year,
      typeOfTruck: req.body.type_of_truck,
      totalWeight: req.body.total_weight,
      palletCapacity: req.body.pallet_capacity,
      maxPayloadKg: req.body.max_payload_kg,
      isActive: req.body.is_active,
    });

    if (!updatedTruck) {
      return res.status(404).json({ error: 'Nie znaleziono pojazdu lub nie masz uprawnień do jego edycji.' });
    }

    res.json(updatedTruck);
  } catch (error) {
    next(error);
  }
};

exports.deleteTruck = async (req, res, next) => {
  try {
    const { truckId } = req.params;
    const changes = await truckService.deleteTruck(truckId);
    if (changes === 0) {
      return res.status(404).json({ error: 'Nie znaleziono pojazdu lub nie masz uprawnień do jego usunięcia.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
//new commit