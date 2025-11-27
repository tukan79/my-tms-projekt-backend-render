// Plik: server/services/trailerService.js
const { Trailer, sequelize } = require('../models');

/**
 * Pobiera wszystkie naczepy przypisane do firmy użytkownika
 */
const findTrailersByCompany = async (companyId = null) => {
  // Możesz dodać filtr po companyId jeśli modele to wspierają
  return Trailer.findAll({
    order: [['registrationPlate', 'ASC']],
  });
};

/**
 * Tworzy nową naczepę
 */
const createTrailer = async (trailerData) => {
  const { registration_plate: registrationPlate, brand, model, capacity_kg: capacityKg } = trailerData;

  if (!registrationPlate || !brand) {
    throw new Error('Numer rejestracyjny i marka są wymagane.');
  }

  return Trailer.create({
    registrationPlate,
    brand,
    model: model || null,
    capacityKg: capacityKg || null,
  });
};

/**
 * Aktualizuje istniejącą naczepę
 */
const updateTrailer = async (trailerId, trailerData) => {
  const { registration_plate: registrationPlate, brand, model, capacity_kg: capacityKg } = trailerData;

  const [updatedCount, updatedTrailers] = await Trailer.update(
    {
      registrationPlate,
      brand,
      model: model || null,
      capacityKg: capacityKg || null,
    },
    {
      where: { id: trailerId },
      returning: true,
    }
  );

  return updatedCount > 0 ? updatedTrailers[0] : null;
};

/**
 * Usuwa naczepę
 */
const deleteTrailer = async (trailerId) => {
  // Jeśli model ma paranoid: true, będzie to soft delete
  return Trailer.destroy({
    where: { id: trailerId },
  });
};

/**
 * Import wielu naczep (bulk) w ramach transakcji
 */
const importTrailers = async (trailerArray) => {
  if (!Array.isArray(trailerArray) || trailerArray.length === 0) {
    throw new Error('Invalid input: array of trailers required.');
  }

  return sequelize.transaction(async (t) => {
    let importedCount = 0;
    const errors = [];

    for (const [index, trailer] of trailerArray.entries()) {
      try {
        const { registration_plate: registrationPlate, brand, model, capacity_kg: capacityKg } = trailer;

        if (!registrationPlate || !brand) {
          errors.push(`Row ${index + 1}: registrationPlate and brand are required.`);
          continue;
        }

        await Trailer.upsert(
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
  findTrailersByCompany,
  createTrailer,
  updateTrailer,
  deleteTrailer,
  importTrailers,
};
