// server/controllers/truckController.js
const truckService = require('../services/truckService.js');

const getAllTrucks = async (req, res, next) => {
  try {
    const trucks = await truckService.findAllTrucks();
    res.status(200).json(trucks || []);
  } catch (error) {
    next(error);
  }
};

const createTruck = async (req, res, next) => {
  try {
    const { registration_plate, brand, model, capacity_kg } = req.body;
    if (!registration_plate || !brand) {
      return res.status(400).json({ error: 'registration_plate and brand are required.' });
    }

    const newTruck = await truckService.createTruck({
      registration_plate,
      brand,
      model,
      capacity_kg,
    });
    res.status(201).json(newTruck);
  } catch (error) {
    next(error);
  }
};

const updateTruck = async (req, res, next) => {
  try {
    const { truckId } = req.params;
    const updatedTruck = await truckService.updateTruck(truckId, req.body);
    if (!updatedTruck) return res.status(404).json({ error: 'Truck not found.' });
    res.status(200).json(updatedTruck);
  } catch (error) {
    next(error);
  }
};

const deleteTruck = async (req, res, next) => {
  try {
    const { truckId } = req.params;
    const deletedCount = await truckService.deleteTruck(truckId);
    if (deletedCount === 0) return res.status(404).json({ error: 'Truck not found.' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const importTrucks = async (req, res, next) => {
  try {
    const { trucks } = req.body;
    if (!Array.isArray(trucks) || trucks.length === 0) {
      return res.status(400).json({ error: 'Field "trucks" must be a non-empty array.' });
    }
    const importResult = await truckService.importTrucks(trucks);
    res.status(201).json(importResult);
  } catch (error) {
    next(error);
  }
};

const exportTrucks = async (req, res, next) => {
  try {
    const { filePath, filename, exportedCount } = await truckService.exportTrucksCSV();
    res.status(200).json({ filePath, filename, exportedCount });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTrucks,
  createTruck,
  updateTruck,
  deleteTruck,
  importTrucks,
  exportTrucks,
};
