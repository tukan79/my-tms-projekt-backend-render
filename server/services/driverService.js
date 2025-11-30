// server/services/driverService.js

const { randomInt } = require('node:crypto');
const { Driver, sequelize } = require('../models');
const logger = require('../config/logger');
const { Op } = require('sequelize');

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

const generateLoginCode = (firstName, lastName) => {
  if (!firstName || !lastName) return null;
  const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
  const randomNumber = randomInt(100, 1000); // crypto-strong 3-digit number
  return `${initials}${randomNumber}`;
};

const normalizeBoolean = (value) => {
  if (typeof value === 'string') {
    return ['true', 'yes', '1', 't', 'checked'].includes(value.toLowerCase());
  }
  return Boolean(value);
};

// ------------------------------------------------------
// CREATE
// ------------------------------------------------------

const createDriver = async (driverData) => {
  const {
    first_name: firstName,
    last_name: lastName,
    phone_number: phoneNumber,
    cpc_number: cpcNumber,
    login_code: loginCodeInput,
    license_number: licenseNumber,
    is_active: isActive,
  } = driverData;

  const loginCode =
    loginCodeInput || generateLoginCode(firstName, lastName);

  try {
    return await Driver.create({
      firstName,
      lastName,
      phoneNumber: phoneNumber || '',
      cpcNumber: cpcNumber || '',
      loginCode,
      licenseNumber: licenseNumber || '',
      isActive: isActive ?? true,
    });
  } catch (error) {
    logger.error('Failed to create driver:', { error });
    throw error;
  }
};

// ------------------------------------------------------
// READ
// ------------------------------------------------------

const findDriversByCompany = async () => {
  try {
    return await Driver.findAll({
      order: [
        ['lastName', 'ASC'],
        ['firstName', 'ASC'],
      ],
    });
  } catch (error) {
    logger.error('Failed to fetch drivers:', { error });
    throw error;
  }
};

const findDriverById = async (driverId) => {
  try {
    return await Driver.findByPk(driverId);
  } catch (error) {
    logger.error('Failed to fetch driver by ID:', { driverId, error });
    throw error;
  }
};

// ------------------------------------------------------
// UPDATE
// ------------------------------------------------------

const updateDriver = async (driverId, driverData) => {
  const {
    first_name: firstName,
    last_name: lastName,
    phone_number: phoneNumber,
    cpc_number: cpcNumber,
    login_code: loginCode,
    license_number: licenseNumber,
    is_active: isActive,
  } = driverData;

  const values = {
    firstName,
    lastName,
    phoneNumber: phoneNumber || '',
    cpcNumber: cpcNumber || '',
    loginCode: loginCode || '',
    licenseNumber: licenseNumber || '',
    isActive,
  };

  try {
    const [count, rows] = await Driver.update(values, {
      where: { id: driverId },
      returning: true,
    });

    return count > 0 ? rows[0] : null;
  } catch (error) {
    logger.error('Failed to update driver:', { driverId, error });
    throw error;
  }
};

// ------------------------------------------------------
// DELETE
// ------------------------------------------------------

const deleteDriver = async (driverId) => {
  try {
    return await Driver.destroy({ where: { id: driverId } });
  } catch (error) {
    logger.error('Failed to delete driver:', { driverId, error });
    throw error;
  }
};

// ------------------------------------------------------
// IMPORT
// ------------------------------------------------------

const toArrayPayload = (driversData) => {
  if (Array.isArray(driversData)) return driversData;
  if (Array.isArray(driversData?.drivers)) return driversData.drivers;
  if (typeof driversData === 'string') {
    try {
      const parsed = JSON.parse(driversData);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.drivers)) return parsed.drivers;
    } catch (e) {
      // not JSON — fall through
    }
  }
  const err = new Error('Invalid payload: expected array of drivers or { drivers: [...] }');
  err.status = 400;
  throw err;
};

const importDrivers = async (driversData) => {
  try {
    const driversArray = toArrayPayload(driversData);

    return await sequelize.transaction(async (t) => {
      const importedDrivers = [];
      const errors = [];
      const processed = [];

      for (const [index, driver] of driversArray.entries()) {
        if (!driver.first_name) {
          errors.push({
            line: index + 2,
            message: 'Missing required field: first_name.',
          });
          continue;
        }

        const loginCode =
          driver.login_code ||
          generateLoginCode(driver.first_name, driver.last_name);

        processed.push({
          firstName: driver.first_name,
          lastName: driver.last_name || '',
          phoneNumber: driver.phone_number || null,
          licenseNumber: driver.license_number || null,
          cpcNumber: driver.cpc_number || null,
          loginCode,
          isActive: normalizeBoolean(driver.is_active),
        });
      }

      if (processed.length > 0) {
        const saved = await Driver.bulkCreate(processed, {
          transaction: t,
          updateOnDuplicate: [
            'firstName',
            'lastName',
            'phoneNumber',
            'licenseNumber',
            'cpcNumber',
            'isActive',
          ],
        });

        importedDrivers.push(...saved);
      }

      return {
        count: importedDrivers.length,
        importedIds: importedDrivers.map((d) => d.id),
        errors,
      };
    });
  } catch (error) {
    logger.error('Failed to import drivers:', { error });
    throw error;
  }
};

// ------------------------------------------------------
// EXPORT
// ------------------------------------------------------

module.exports = {
  createDriver,
  findDriversByCompany,
  findDriverById,
  updateDriver,
  deleteDriver,
  importDrivers,
};
