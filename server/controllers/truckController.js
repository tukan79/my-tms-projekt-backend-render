// Plik: server/services/truckService.js
const { Truck, sequelize } = require('../models');

/**
 * Pobiera wszystkie pojazdy przypisane do firmy użytkownika
 */
const findTrucksByCompany = async (companyId = null) => {
  // Możesz dodać filtr po companyId jeśli modele to wspierają
  return Truck.findAll({
    order: [['registrationPlate', 'ASC']],
  });
};

/**
 * Tworzy nowy pojazd
 */
const createTruck = async (truckData) => {
  const { registration_plate: registrationPlate, brand, model, capacity_kg: capacityKg } = truckData;

  if (!registrationPlate || !brand) {
    throw new Error('Numer rejestracyjny i marka są wymagane.');
  }

  return Truck.create({
    registrationPlate,
    brand,
    model: model || null,
    capacityKg: capacityKg || null,
  });
};

/**
 * Aktualizuje istniejący pojazd
 */
const updateTruck = async (truckId, truckData) => {
  const { registration_plate: registrationPlate, brand, model, capacity_kg: capacityKg } = truckData;

  const [updatedCount, updatedTrucks] = await Truck.update(
    {
      registrationPlate,
      brand,
      model: model || null,
      capacityKg: capacityKg || null,
    },
    {
      where: { id: truckId },
      returning: true,
    }
  );

  return updatedCount > 0 ? updatedTrucks[0] : null;
};

/**
 * Usuwa pojazd
 */
const deleteTruck = async (truckId) => {
  // Jeśli model ma paranoid: true, będzie to soft delete
  return Truck.destroy({
    where: { id: truckId },
  });
};

/**
 * Import wielu pojazdów (bulk) w ramach transakcji
 */
const importTrucks = async (truckArray) => {
  if (!Array.isArray(truckArray) || truckArray.length === 0) {
    throw new Error('Invalid input: array of trucks required.');
  }

  return sequelize.transaction(async (t) => {
    let importedCount = 0;
    const errors = [];

    for (const [index, truck] of truckArray.entries()) {
      try {
        const { registration_plate: registrationPlate, brand, model, capacity_kg: capacityKg } = truck;

        if (!registrationPlate || !brand) {
          errors.push(`Row ${index + 1}: registrationPlate and brand are required.`);
          continue;
        }

        await Truck.upsert(
          {
            registrationPlate,
            brand,
            model: model || null,
            capacityKg: capacityKg || null,
          },
          { transaction: t }
        );

        importedCount++;
      } catch (err) {
        errors.push(`Row ${index + 1}: ${err.message}`);
      }
    }

    return { importedCount, errors };
  });
};

module.exports = {
  findTrucksByCompany,
  createTruck,
  updateTruck,
  deleteTruck,
  importTrucks,
};
