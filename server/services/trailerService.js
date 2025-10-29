const { Trailer, sequelize } = require('../models');

const createTrailer = async (trailerData) => {
  const { 
    registration_plate: registrationPlate, brand, description, category, max_payload_kg: maxPayloadKg,
    max_spaces: maxSpaces, length_m: lengthM, width_m: widthM, height_m: heightM, weight_kg: weightKg, status
  } = trailerData;
  try {
    const newTrailer = await Trailer.create({
      registrationPlate,
      brand,
      description,
      category,
      maxPayloadKg,
      maxSpaces,
      lengthM,
      widthM,
      heightM,
      weightKg,
      status,
      isActive: status === 'active',
    });
    return newTrailer;
  } catch (error) {
    // Pozwól, aby centralny errorMiddleware obsłużył błąd (np. 23505 dla unique_violation)
    throw error;
  }
};

const findTrailersByCompany = async () => {
    // `paranoid: true` w modelu automatycznie dodaje warunek `is_deleted = FALSE`
    return Trailer.findAll({
      order: [['registrationPlate', 'ASC']],
    });
};

const updateTrailer = async (trailerId, trailerData) => {
  const { 
    registration_plate: registrationPlate, brand, description, category, max_payload_kg: maxPayloadKg,
    max_spaces: maxSpaces, length_m: lengthM, width_m: widthM, height_m: heightM, weight_kg: weightKg, status
  } = trailerData;

  const dataToUpdate = {
    registrationPlate,
    brand,
    description,
    category,
    maxPayloadKg,
    maxSpaces,
    lengthM,
    widthM,
    heightM,
    weightKg,
    status,
    isActive: status === 'active',
  };

  const [updatedRowsCount, updatedTrailers] = await Trailer.update(
    dataToUpdate,
    {
      where: { id: trailerId },
      returning: true,
    }
  );

  return updatedRowsCount > 0 ? updatedTrailers[0] : null;
};

const deleteTrailer = async (trailerId) => {
  // `destroy` z `paranoid: true` w modelu wykona soft delete
  return Trailer.destroy({ where: { id: trailerId } });
};

const importTrailers = async (trailersData) => {
  return sequelize.transaction(async (t) => {
    const trailersToCreateOrUpdate = [];

    for (const trailer of trailersData) {
      if (!trailer.registration_plate) continue;

      const status = trailer.status || 'inactive';

      trailersToCreateOrUpdate.push({
        registrationPlate: trailer.registration_plate,
        description: trailer.description,
        category: trailer.category,
        brand: trailer.brand,
        maxPayloadKg: trailer.max_payload_kg,
        maxSpaces: trailer.max_spaces,
        lengthM: trailer.length_m,
        widthM: trailer.width_m,
        heightM: trailer.height_m,
        weightKg: trailer.weight_kg,
        status: status,
        isActive: status === 'active',
      });
    }

    if (trailersToCreateOrUpdate.length === 0) {
      return { importedCount: 0, importedIds: [] };
    }

    const importedTrailers = await Trailer.bulkCreate(trailersToCreateOrUpdate, {
      transaction: t,
      updateOnDuplicate: [
        'description', 'category', 'brand', 'maxPayloadKg', 'maxSpaces', 
        'lengthM', 'widthM', 'heightM', 'weightKg', 'status', 'isActive'
      ],
    });

    return { importedCount: importedTrailers.length, importedIds: importedTrailers.map(t => t.id) };
  });
};

module.exports = {
  createTrailer,
  findTrailersByCompany,
  updateTrailer,
  deleteTrailer,
  importTrailers,
};