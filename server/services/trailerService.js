const db = require('../db/index.js');

const createTrailer = async (trailerData) => {
  const { 
    registration_plate, brand, description, category, max_payload_kg, 
    max_spaces, length_m, width_m, height_m, weight_kg, status 
  } = trailerData;
  try {
    const result = await db.query(
      `INSERT INTO trailers (
        registration_plate, brand, description, category, max_payload_kg, 
        max_spaces, length_m, width_m, height_m, weight_kg, status, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        registration_plate, 
        brand, 
        description, 
        category, 
        max_payload_kg, 
        max_spaces, 
        length_m, 
        width_m, 
        height_m, 
        weight_kg, 
        status,
        status === 'active'
      ]
    );
    return result.rows[0];
  } catch (error) {
    // Pozwól, aby centralny errorMiddleware obsłużył błąd (np. 23505 dla unique_violation)
    // Możesz dostosować komunikat w errorMiddleware, jeśli chcesz być bardziej szczegółowy
    throw error;
  }
};

const findTrailersByCompany = async () => {
    const { rows } = await db.query('SELECT * FROM trailers WHERE is_deleted = FALSE ORDER BY registration_plate');
    return rows;
};

const updateTrailer = async (trailerId, trailerData) => {
  const { 
    registration_plate, brand, description, category, max_payload_kg, 
    max_spaces, length_m, width_m, height_m, weight_kg, status 
  } = trailerData;
  const result = await db.query(
    `UPDATE trailers 
     SET registration_plate = $1, brand = $2, description = $3, category = $4, 
         max_payload_kg = $5, max_spaces = $6, length_m = $7, width_m = $8, 
         height_m = $9, weight_kg = $10, status = $11, is_active = $12, updated_at = NOW()
     WHERE id = $13 RETURNING *`,
    [
      registration_plate, 
      brand, 
      description, 
      category, 
      max_payload_kg, 
      max_spaces, 
      length_m, 
      width_m, 
      height_m, 
      weight_kg, 
      status,
      status === 'active',
      trailerId
    ]
  );
  if (result.rowCount === 0) return null;
  return result.rows[0];
};

const deleteTrailer = async (trailerId) => {
  const result = await db.query('UPDATE trailers SET is_deleted = TRUE WHERE id = $1', [trailerId]);
  return result.rowCount;
};

const importTrailers = async (trailersData) => {
  return db.withTransaction(async (client) => {
    const importedTrailers = [];
    const sql = `
      INSERT INTO trailers (
        registration_plate, description, category, brand, max_payload_kg, max_spaces, 
        length_m, width_m, height_m, weight_kg, status, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (registration_plate) DO UPDATE SET
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        brand = EXCLUDED.brand,
        max_payload_kg = EXCLUDED.max_payload_kg,
        max_spaces = EXCLUDED.max_spaces,
        length_m = EXCLUDED.length_m,
        width_m = EXCLUDED.width_m,
        height_m = EXCLUDED.height_m,
        weight_kg = EXCLUDED.weight_kg,
        status = EXCLUDED.status,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING id;
    `;

    for (const trailer of trailersData) {
      const result = await client.query(sql, [
        trailer.registration_plate,
        trailer.description,
        trailer.category,
        trailer.brand,
        trailer.max_payload_kg,
        trailer.max_spaces,
        trailer.length_m,
        trailer.width_m,
        trailer.height_m,
        trailer.weight_kg,
        trailer.status,
        trailer.status === 'active',
      ]);

      if (result.rows.length > 0) {
        importedTrailers.push(result.rows[0]);
      }
    }

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