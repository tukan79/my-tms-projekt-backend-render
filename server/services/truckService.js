// server/services/truckService.js
const { Truck, sequelize } = require('../models');

const createTruck = async (truckData) => {
  const {
    registration_plate: registrationPlate, brand, model, vin, production_year: productionYear,
    type_of_truck: typeOfTruck, total_weight: totalWeight, pallet_capacity: palletCapacity, max_payload_kg: maxPayloadKg, is_active: isActive
  } = truckData;

  try {
    const newTruck = await Truck.create({
      registrationPlate,
      brand,
      model,
      vin,
      productionYear,
      typeOfTruck,
      totalWeight,
      palletCapacity,
      maxPayloadKg,
      isActive,
    });
    return newTruck;
  } catch (error) {
    throw error;
  }
};

const findTrucksByCompany = async () => {
  // `paranoid: true` w modelu automatycznie dodaje warunek `is_deleted = FALSE`
  return Truck.findAll({
    order: [['brand', 'ASC'], ['model', 'ASC']],
  });
};

const updateTruck = async (truckId, truckData) => {
  const {
    registration_plate: registrationPlate, brand, model, vin, production_year: productionYear,
    type_of_truck: typeOfTruck, total_weight: totalWeight, pallet_capacity: palletCapacity, max_payload_kg: maxPayloadKg, is_active: isActive
  } = truckData;

  const dataToUpdate = {
    registrationPlate,
    brand,
    model,
    vin,
    productionYear,
    typeOfTruck,
    totalWeight,
    palletCapacity,
    maxPayloadKg,
    isActive,
  };

  const [updatedRowsCount, updatedTrucks] = await Truck.update(
    dataToUpdate,
    {
      where: { id: truckId },
      returning: true,
    }
  );

  return updatedRowsCount > 0 ? updatedTrucks[0] : null;
};

const deleteTruck = async (truckId) => {
  // `destroy` z `paranoid: true` w modelu wykona soft delete
  return Truck.destroy({ where: { id: truckId } });
};

const toInt = (value) => {
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
};

const toBoolean = (value) => {
  if (value === false) return false;
  if (typeof value === 'string') {
    return ['true', 'yes', '1', 't'].includes(value.toLowerCase());
  }
  return Boolean(value);
};

const importTrucks = async (trucksData) => {
  return sequelize.transaction(async (t) => {
    const trucksToCreateOrUpdate = [];

    for (const truck of trucksData) {
      if (!truck.registration_plate) continue; // Pomiń wiersze bez numeru rejestracyjnego

      trucksToCreateOrUpdate.push({
        registrationPlate: truck.registration_plate,
        brand: truck.brand,
        model: truck.model || '',
        vin: truck.vin || null,
        productionYear: toInt(truck.production_year),
        typeOfTruck: truck.type_of_truck?.toLowerCase() === 'rigid' ? 'rigid' : 'tractor',
        totalWeight: toInt(truck.total_weight),
        palletCapacity: toInt(truck.pallet_capacity),
        maxPayloadKg: toInt(truck.max_payload_kg),
        isActive: toBoolean(truck.is_active),
      });
    }

    if (trucksToCreateOrUpdate.length === 0) {
      return { importedCount: 0, importedIds: [] };
    }

    const importedTrucks = await Truck.bulkCreate(trucksToCreateOrUpdate, {
      transaction: t,
      updateOnDuplicate: ['brand', 'model', 'vin', 'productionYear', 'typeOfTruck', 'totalWeight', 'palletCapacity', 'maxPayloadKg', 'isActive'],
    });

    return { importedCount: importedTrucks.length, importedIds: importedTrucks.map(t => t.id) };
  });
};

module.exports = {
  createTruck,
  findTrucksByCompany,
  updateTruck,
  deleteTruck,
  importTrucks,
};