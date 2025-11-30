// Plik: server/services/trailerService.js
const { Trailer, sequelize } = require('../models');

const toInt = (value) => {
  const num = Number.parseFloat(value);
  return Number.isNaN(num) ? null : num;
};

const toBoolean = (value) => {
  if (value === false) return false;
  if (typeof value === 'string') {
    return ['true', 'yes', '1', 't', 'y'].includes(value.toLowerCase());
  }
  return Boolean(value);
};

const normalizeTrailerData = (data) => ({
  registrationPlate: data.registration_plate,
  description: data.description || null,
  category: data.category || null,
  brand: data.brand || null,
  maxPayloadKg: toInt(data.max_payload_kg),
  maxSpaces: toInt(data.max_spaces),
  lengthM: toInt(data.length_m),
  widthM: toInt(data.width_m),
  heightM: toInt(data.height_m),
  weightKg: toInt(data.weight_kg),
  status: data.status || 'inactive',
  isActive: toBoolean(data.is_active),
});

const toArrayPayload = (input) => {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.trailers)) return input.trailers;
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.trailers)) return parsed.trailers;
    } catch (_) {
      // not JSON
    }
  }
  const err = new Error('Invalid payload: expected array of trailers or { trailers: [...] }');
  err.status = 400;
  throw err;
};

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
  const payload = normalizeTrailerData(trailerData);
  const { registrationPlate, brand } = payload;

  if (!registrationPlate || !brand) {
    throw new Error('Numer rejestracyjny i marka są wymagane.');
  }

  return Trailer.create(payload);
};

/**
 * Aktualizuje istniejącą naczepę
 */
const updateTrailer = async (trailerId, trailerData) => {
  const dataToUpdate = normalizeTrailerData(trailerData);

  const [updatedCount, updatedTrailers] = await Trailer.update(
    dataToUpdate,
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
  const trailersData = toArrayPayload(trailerArray);
  if (trailersData.length === 0) {
    throw new Error('Invalid input: array of trailers required.');
  }

  return sequelize.transaction(async (t) => {
    let importedCount = 0;
    const errors = [];

    for (const [index, trailer] of trailersData.entries()) {
      try {
        const payload = normalizeTrailerData(trailer);
        const { registrationPlate, brand } = payload;

        if (!registrationPlate || !brand) {
          errors.push(`Row ${index + 1}: registrationPlate and brand are required.`);
          continue;
        }

        await Trailer.upsert(payload, { transaction: t });

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
