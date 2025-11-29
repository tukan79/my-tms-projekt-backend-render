// server/services/truckService.js
const { Truck, sequelize } = require('../models');
const logger = require('../config/logger');
const Papa = require('papaparse');
const fs = require('node:fs');
const path = require('node:path');

// --- Helpers -----------------------------------------------------

const toInt = (value) => {
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
};

const toBoolean = (value) => {
  if (value === false) return false;
  if (typeof value === 'string') {
    return ['true', 'yes', '1', 't'].includes(value.toLowerCase());
  }
  return Boolean(value);
};

// --- Normalizing Input ------------------------------------------

function normalizeTruckData(data) {
  return {
    registrationPlate: data.registration_plate,
    brand: data.brand,
    model: data.model || null,
    vin: data.vin || null,
    productionYear: toInt(data.production_year),
    typeOfTruck: data.type_of_truck?.toLowerCase() === 'rigid' ? 'rigid' : 'tractor',
    totalWeight: toInt(data.total_weight),
    palletCapacity: toInt(data.pallet_capacity),
    maxPayloadKg: toInt(data.max_payload_kg),
    isActive: toBoolean(data.is_active),
  };
}

// --- CRUD Services ----------------------------------------------

const createTruck = async (truckData) => {
  const payload = normalizeTruckData(truckData);

  try {
    const newTruck = await Truck.create(payload);
    return newTruck;
  } catch (error) {
    logger.error('Error creating truck', { error: error.message, payload });
    throw error;
  }
};

const findAllTrucks = async () => {
  try {
    return await Truck.findAll({
      order: [['brand', 'ASC'], ['model', 'ASC']],
    });
  } catch (error) {
    logger.error('Error finding all trucks', { error: error.message });
    throw error;
  }
};

const updateTruck = async (truckId, truckData) => {
  const dataToUpdate = normalizeTruckData(truckData);

  try {
    const [updatedRowsCount, updatedTrucks] = await Truck.update(dataToUpdate, {
      where: { id: truckId },
      returning: true,
    });

    return updatedRowsCount > 0 ? updatedTrucks[0] : null;
  } catch (error) {
    logger.error(`Error updating truck ID ${truckId}`, {
      error: error.message,
      truckId,
      dataToUpdate,
    });
    throw error;
  }
};

const deleteTruck = async (truckId) => {
  try {
    return await Truck.destroy({ where: { id: truckId } }); // Soft delete if paranoid:true
  } catch (error) {
    logger.error(`Error deleting truck ID ${truckId}`, { error: error.message });
    throw error;
  }
};

// --- Import Trucks ----------------------------------------------

const importTrucks = async (trucksData) => {
  return sequelize.transaction(async (t) => {
    const trucksToCreateOrUpdate = trucksData
      .filter(truck => truck.registration_plate)
      .map(truck => normalizeTruckData(truck));

    if (trucksToCreateOrUpdate.length === 0) {
      return { importedCount: 0, importedIds: [] };
    }

    const importedTrucks = await Truck.bulkCreate(trucksToCreateOrUpdate, {
      transaction: t,
      updateOnDuplicate: [
        'brand', 'model', 'vin', 'productionYear', 'typeOfTruck',
        'totalWeight', 'palletCapacity', 'maxPayloadKg', 'isActive'
      ],
    });

    return {
      importedCount: importedTrucks.length,
      importedIds: importedTrucks.map(t => t.id)
    };
  });
};

// --- Export CSV ----------------------------------------------

const exportTrucksCSV = async (exportDir = path.join(__dirname, '../exports')) => {
  const trucks = await findAllTrucks();
  const plainTrucks = trucks.map(t => t.get({ plain: true }));
  const csv = Papa.unparse(plainTrucks);

  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const filename = `trucks_${timestamp}.csv`;
  const filePath = path.join(exportDir, filename);

  fs.writeFileSync(filePath, csv, 'utf8');

  return { filePath, filename, exportedCount: plainTrucks.length };
};

// --- Exports -----------------------------------------------------

module.exports = {
  createTruck,
  findAllTrucks,
  updateTruck,
  deleteTruck,
  importTrucks,
  exportTrucksCSV,
};
