// Plik server/services/driverService.js
const db = require('../db/index.js');

/**
 * Tworzy nowego kierowcę dla zalogowanego użytkownika (firmy).
 * Creates a new driver for the logged-in user (company).
 * @param {object} driverData - Dane kierowcy.
 * @returns {Promise<object>} Nowo utworzony obiekt kierowcy.
 */
const createDriver = async (driverData) => {
  let { first_name, last_name, phone_number = '', cpc_number = '', login_code = '', license_number = '', is_active = true } = driverData;

  // Automatyczne generowanie login_code, jeśli nie został podany.
  // Automatically generate login_code if not provided.
  if (!login_code && first_name && last_name) {
    const initials = (first_name[0] + last_name[0]).toUpperCase();
    // Generuje losowy 3-cyfrowy numer, aby zapewnić unikalność.
    // Generates a random 3-digit number to ensure uniqueness.
    const randomNumber = Math.floor(100 + Math.random() * 900); 
    login_code = `${initials}${randomNumber}`;
  }

  const sql = `
    INSERT INTO drivers (first_name, last_name, phone_number, cpc_number, login_code, license_number, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
  `;

  try {
    const result = await db.query(sql, [first_name, last_name, phone_number, cpc_number, login_code, license_number, is_active]);
    
    // Zwróć pełny obiekt z bazy danych.
    // Return the full object from the database.
    return result.rows[0];
  } catch (error) {
    // Pozwól, aby centralny errorMiddleware obsłużył błąd (np. 23505 dla unique_violation).
    // Let the central errorMiddleware handle the error (e.g., 23505 for unique_violation).
    // Możesz dostosować komunikat w errorMiddleware, jeśli chcesz być bardziej szczegółowy.
    // You can customize the message in errorMiddleware if you want to be more specific.
    throw error;
  }
};

/**
 * Znajduje wszystkich kierowców dla danej firmy.
 * Finds all drivers for a given company.
 * @returns {Promise<Array<object>>} Tablica obiektów kierowców.
 */
const findDriversByCompany = async () => {
  const { rows } = await db.query('SELECT * FROM drivers WHERE is_deleted = FALSE ORDER BY last_name, first_name');
  return rows;
};

/**
 * Znajduje jednego kierowcę po jego ID, upewniając się, że należy do firmy zalogowanego użytkownika.
 * Finds a single driver by their ID, ensuring they belong to the logged-in user's company.
 * @param {number} driverId - ID kierowcy. * @param {number} companyId - ID firmy.
 * @returns {Promise<object|null>} Obiekt kierowcy lub null, jeśli nie znaleziono.
 */
const findDriverById = async (driverId) => {
  const { rows } = await db.query('SELECT * FROM drivers WHERE id = $1 AND is_deleted = FALSE', [driverId]);
  return rows[0] || null;
};

/**
 * Aktualizuje dane kierowcy.
 * Updates driver data.
 * @param {number} driverId - ID kierowcy do aktualizacji.
 * @param {object} driverData - Nowe dane kierowcy. * @param {number} companyId - ID firmy.
 * @returns {Promise<object|null>} Zaktualizowany obiekt kierowcy lub null.
 */
const updateDriver = async (driverId, driverData) => {
  const { first_name, last_name, phone_number = '', cpc_number = '', login_code = '', license_number = '', is_active } = driverData;

  const sql = `
    UPDATE drivers
    SET first_name = $1, last_name = $2, phone_number = $3, cpc_number = $4, login_code = $5, license_number = $6, is_active = $7
    WHERE id = $8 RETURNING *
  `;

  const result = await db.query(sql, [first_name, last_name, phone_number, cpc_number, login_code, license_number, is_active, driverId]);

  if (result.rowCount === 0) {
    // Nie znaleziono kierowcy lub brak uprawnień.
    // Driver not found or no permissions.
    return null;
  }

  // Zwróć zaktualizowany obiekt z bazy danych.
  // Return the updated object from the database.
  return result.rows[0];
};

/**
 * Usuwa kierowcę.
 * Deletes a driver.
 * @param {number} driverId - ID kierowcy do usunięcia. * @param {number} companyId - ID firmy.
 * @returns {Promise<number>} Liczba usuniętych wierszy (0 lub 1).
 */
const deleteDriver = async (driverId) => {
  const result = await db.query('UPDATE drivers SET is_deleted = TRUE WHERE id = $1', [driverId]);
  return result.rowCount;
};

const importDrivers = async (driversData) => {
  return db.withTransaction(async (client) => {
    const importedDrivers = [];
    const errors = [];
    const sql = `
      INSERT INTO drivers (first_name, last_name, phone_number, license_number, cpc_number, login_code, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (login_code) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone_number = EXCLUDED.phone_number, -- Aktualizuj phone_number
        license_number = EXCLUDED.license_number, -- Aktualizuj license_number
        cpc_number = EXCLUDED.cpc_number, -- Aktualizuj cpc_number
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING id;
    `;

    const toBoolean = (value) => {
      if (typeof value === 'string') {
        return ['true', 'yes', '1', 't', 'checked'].includes(value.toLowerCase());
      }
      return Boolean(value);
    };

    for (const [index, driver] of driversData.entries()) {
      // Złagodzona walidacja - wymagamy tylko imienia.
      if (!driver.first_name) {
        errors.push({ line: index + 2, message: 'Missing required field: first_name.' });
        continue;
      }

      let login_code = driver.login_code;
      // Automatycznie generuj login_code, jeśli go brakuje, tak jak w createDriver
      if (!login_code && driver.first_name && driver.last_name) {
        const initials = (driver.first_name[0] + driver.last_name[0]).toUpperCase();
        const randomNumber = Math.floor(100 + Math.random() * 900);
        login_code = `${initials}${randomNumber}`;
      }

      const result = await client.query(sql, [
        driver.first_name, driver.last_name || '', driver.phone_number || null, 
        driver.license_number || null, driver.cpc_number || null, 
        login_code, toBoolean(driver.is_active)
      ]);
      if (result.rows.length > 0) {
        importedDrivers.push(result.rows[0]);
      }
    }
    return { count: importedDrivers.length, importedIds: importedDrivers.map(d => d.id), errors };
  });
};

module.exports = {
  createDriver,
  findDriversByCompany,
  findDriverById,
  updateDriver,
  deleteDriver,
  importDrivers,
};