// Plik: server/services/postcodeZoneService.js
const { PostcodeZone, sequelize } = require('../models');

/* ============================================================================
   HELPERS
============================================================================ */

/**
 * Normalizuje listę wzorców kodów pocztowych:
 * - string z separatorami ";" → tablica
 * - pusty input → []
 */
function normalizePatterns(patterns) {
  if (typeof patterns === 'string') {
    return patterns
      .split(';')
      .map(p => p.trim())
      .filter(Boolean);
  }

  if (Array.isArray(patterns)) return patterns;

  return [];
}

/**
 * Normalizuje flagę is_home_zone (różne możliwe formaty)
 */
function normalizeIsHome(value) {
  return ['true', '1', 'yes', 'y'].includes(String(value).toLowerCase());
}

/* ============================================================================
   CREATE
============================================================================ */

const createZone = async (zoneData) => {
  const {
    zone_name,
    postcode_patterns,
    is_home_zone,
  } = zoneData;

  return PostcodeZone.create({
    zoneName: zone_name,
    postcodePatterns: normalizePatterns(postcode_patterns),
    isHomeZone: Boolean(is_home_zone),
  });
};

/* ============================================================================
   FIND ALL
============================================================================ */

const findAllZones = async () => {
  return PostcodeZone.findAll({
    order: [['zoneName', 'ASC']],
  });
};

/* ============================================================================
   UPDATE
============================================================================ */

const updateZone = async (zoneId, zoneData) => {
  const {
    zone_name,
    postcode_patterns,
    is_home_zone,
  } = zoneData;

  const [count, updatedRows] = await PostcodeZone.update(
    {
      zoneName: zone_name,
      postcodePatterns: normalizePatterns(postcode_patterns),
      isHomeZone: Boolean(is_home_zone),
    },
    {
      where: { id: zoneId },
      returning: true,
    }
  );

  return count > 0 ? updatedRows[0] : null;
};

/* ============================================================================
   DELETE
============================================================================ */

const deleteZone = async (zoneId) => {
  // przyszłościowo: można dodać walidację, czy strefa nie jest używana w cenniku
  return PostcodeZone.destroy({ where: { id: zoneId } });
};

/* ============================================================================
   IMPORT (bulk + updateOnDuplicate)
============================================================================ */

const importZones = async (zonesData) => {
  return sequelize.transaction(async (t) => {
    const cleanedZones = zonesData
      .filter(z => z.zone_name) // pomijamy puste
      .map(z => ({
        zoneName: z.zone_name,
        postcodePatterns: normalizePatterns(z.postcode_patterns),
        isHomeZone: normalizeIsHome(z.is_home_zone),
      }));

    if (cleanedZones.length === 0) {
      return { count: 0 };
    }

    const imported = await PostcodeZone.bulkCreate(cleanedZones, {
      transaction: t,
      updateOnDuplicate: ['postcodePatterns', 'isHomeZone'],
    });

    return { count: imported.length };
  });
};

/* ============================================================================
   EXPORT
============================================================================ */
module.exports = {
  createZone,
  findAllZones,
  updateZone,
  deleteZone,
  importZones,
};
