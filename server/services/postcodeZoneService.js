// Plik server/services/postcodeZoneService.js
const { PostcodeZone, sequelize } = require('../models');

const createZone = async (zoneData) => {
  const { zone_name: zoneName, postcode_patterns: postcodePatterns, is_home_zone: isHomeZone } = zoneData;
  return PostcodeZone.create({
    zoneName,
    postcodePatterns: postcodePatterns || [],
    isHomeZone: isHomeZone || false,
  });
};

const findAllZones = async () => {
  return PostcodeZone.findAll({
    order: [['zoneName', 'ASC']],
  });
};

const updateZone = async (zoneId, zoneData) => {
  const { zone_name: zoneName, postcode_patterns: postcodePatterns, is_home_zone: isHomeZone } = zoneData;
  
  const [updatedRowsCount, updatedZones] = await PostcodeZone.update(
    {
      zoneName,
      postcodePatterns,
      isHomeZone,
    },
    {
      where: { id: zoneId },
      returning: true,
    }
  );

  return updatedRowsCount > 0 ? updatedZones[0] : null;
};

const deleteZone = async (zoneId) => {
  // W przyszłości można dodać walidację, czy strefa nie jest używana w żadnym cenniku
  // Model PostcodeZone nie ma `paranoid: true`, więc to będzie twarde usunięcie.
  return PostcodeZone.destroy({ where: { id: zoneId } });
};

const importZones = async (zonesData) => {
  return sequelize.transaction(async (t) => {
    const zonesToCreateOrUpdate = [];

    for (const zone of zonesData) {
      if (!zone.zone_name) continue;

      let patterns;
      if (typeof zone.postcode_patterns === 'string') {
        patterns = zone.postcode_patterns.split(';').map(p => p.trim()).filter(Boolean);
      } else if (Array.isArray(zone.postcode_patterns)) {
        patterns = zone.postcode_patterns;
      } else {
        patterns = [];
      }
      const isHomeZone = ['true', 'yes', '1'].includes(String(zone.is_home_zone).toLowerCase());

      zonesToCreateOrUpdate.push({
        zoneName: zone.zone_name,
        postcodePatterns: patterns,
        isHomeZone: isHomeZone,
      });
    }

    if (zonesToCreateOrUpdate.length === 0) {
      return { count: 0 };
    }

    const importedZones = await PostcodeZone.bulkCreate(zonesToCreateOrUpdate, {
      transaction: t,
      updateOnDuplicate: ['postcodePatterns', 'isHomeZone'], // Pola do aktualizacji przy konflikcie
    });

    return { count: importedZones.length };
  });
};

module.exports = {
  createZone,
  findAllZones,
  updateZone,
  deleteZone,
  importZones,
};