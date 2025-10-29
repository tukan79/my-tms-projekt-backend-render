// Plik server/services/driverService.js
const { Driver, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Tworzy nowego kierowcę dla zalogowanego użytkownika (firmy).
 * Creates a new driver for the logged-in user (company).
 * @param {object} driverData - Dane kierowcy.
 * @returns {Promise<object>} Nowo utworzony obiekt kierowcy.
 */
const createDriver = async (driverData) => {
  let { first_name: firstName, last_name: lastName, phone_number: phoneNumber = '', cpc_number: cpcNumber = '', login_code: loginCode = '', license_number: licenseNumber = '', is_active: isActive = true } = driverData;

  // Automatyczne generowanie login_code, jeśli nie został podany.
  // Automatically generate login_code if not provided.
  if (!loginCode && firstName && lastName) {
    const initials = (firstName[0] + lastName[0]).toUpperCase();
    // Generuje losowy 3-cyfrowy numer, aby zapewnić unikalność.
    // Generates a random 3-digit number to ensure uniqueness.
    const randomNumber = Math.floor(100 + Math.random() * 900); 
    loginCode = `${initials}${randomNumber}`;
  }

  try {
    const newDriver = await Driver.create({
      firstName,
      lastName,
      phoneNumber,
      cpcNumber,
      loginCode,
      licenseNumber,
      isActive,
    });
    return newDriver;
  } catch (error) {
    // Pozwól, aby centralny errorMiddleware obsłużył błąd (np. 23505 dla unique_violation).
    throw error;
  }
};

/**
 * Znajduje wszystkich kierowców dla danej firmy.
 * @returns {Promise<Array<object>>} Tablica obiektów kierowców.
 */
const findDriversByCompany = async () => {
  // `paranoid: true` w modelu automatycznie dodaje warunek `is_deleted = FALSE`
  return Driver.findAll({
    order: [['lastName', 'ASC'], ['firstName', 'ASC']],
  });
};

/**
 * Znajduje jednego kierowcę po jego ID, upewniając się, że należy do firmy zalogowanego użytkownika.
 * @param {number} driverId - ID kierowcy. * @param {number} companyId - ID firmy.
 * @returns {Promise<object|null>} Obiekt kierowcy lub null, jeśli nie znaleziono.
 */
const findDriverById = async (driverId) => {
  // `findByPk` automatycznie uwzględnia `paranoid: true`
  return Driver.findByPk(driverId);
};

/**
 * Aktualizuje dane kierowcy.
 * @param {number} driverId - ID kierowcy do aktualizacji.
 * @param {object} driverData - Nowe dane kierowcy. * @param {number} companyId - ID firmy.
 * @returns {Promise<object|null>} Zaktualizowany obiekt kierowcy lub null.
 */
const updateDriver = async (driverId, driverData) => {
  const { first_name: firstName, last_name: lastName, phone_number: phoneNumber = '', cpc_number: cpcNumber = '', login_code: loginCode = '', license_number: licenseNumber = '', is_active: isActive } = driverData;

  const dataToUpdate = {
    firstName,
    lastName,
    phoneNumber,
    cpcNumber,
    loginCode,
    licenseNumber,
    isActive,
  };

  const [updatedRowsCount, updatedDrivers] = await Driver.update(
    dataToUpdate,
    {
      where: { id: driverId },
      returning: true,
    }
  );

  return updatedRowsCount > 0 ? updatedDrivers[0] : null;
};

/**
 * Usuwa kierowcę.
 * @param {number} driverId - ID kierowcy do usunięcia. * @param {number} companyId - ID firmy.
 * @returns {Promise<number>} Liczba usuniętych wierszy (0 lub 1).
 */
const deleteDriver = async (driverId) => {
  // `destroy` z `paranoid: true` w modelu wykona soft delete
  return Driver.destroy({ where: { id: driverId } });
};

const importDrivers = async (driversData) => {
  return sequelize.transaction(async (t) => {
    const importedDrivers = [];
    const errors = [];

    const toBoolean = (value) => {
      if (typeof value === 'string') {
        return ['true', 'yes', '1', 't', 'checked'].includes(value.toLowerCase());
      }
      return Boolean(value);
    };

    const driversToCreateOrUpdate = [];
    for (const [index, driver] of driversData.entries()) {
      // Złagodzona walidacja - wymagamy tylko imienia.
      if (!driver.first_name) {
        errors.push({ line: index + 2, message: 'Missing required field: first_name.' });
        continue;
      }

      let loginCode = driver.login_code;
      // Automatycznie generuj login_code, jeśli go brakuje, tak jak w createDriver
      if (!loginCode && driver.first_name && driver.last_name) {
        const initials = (driver.first_name[0] + driver.last_name[0]).toUpperCase();
        const randomNumber = Math.floor(100 + Math.random() * 900);
        loginCode = `${initials}${randomNumber}`;
      }

      driversToCreateOrUpdate.push({
        firstName: driver.first_name,
        lastName: driver.last_name || '',
        phoneNumber: driver.phone_number || null,
        licenseNumber: driver.license_number || null,
        cpcNumber: driver.cpc_number || null,
        loginCode: loginCode,
        isActive: toBoolean(driver.is_active),
      });
    }

    if (driversToCreateOrUpdate.length > 0) {
      const createdOrUpdated = await Driver.bulkCreate(driversToCreateOrUpdate, {
        transaction: t,
        updateOnDuplicate: ['firstName', 'lastName', 'phoneNumber', 'licenseNumber', 'cpcNumber', 'isActive'],
      });
      importedDrivers.push(...createdOrUpdated);
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