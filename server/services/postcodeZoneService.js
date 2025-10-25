// Plik server/services/postcodeZoneService.js
const db = require('../db/index.js');

const createZone = async (zoneData) => {
  const { zone_name, postcode_patterns, is_home_zone } = zoneData;
  const sql = `
    INSERT INTO postcode_zones (zone_name, postcode_patterns, is_home_zone)
    VALUES ($1, $2, $3) RETURNING *
  `;
  const { rows } = await db.query(sql, [zone_name, postcode_patterns || [], is_home_zone || false]);
  return rows[0];
};

const findAllZones = async () => {
  const { rows } = await db.query('SELECT * FROM postcode_zones ORDER BY zone_name');
  return rows;
};

const updateZone = async (zoneId, zoneData) => {
  const { zone_name, postcode_patterns, is_home_zone } = zoneData;
  const sql = `
    UPDATE postcode_zones
    SET zone_name = $1, postcode_patterns = $2, is_home_zone = $3, updated_at = NOW()
    WHERE id = $4 RETURNING *
  `;
  const { rows } = await db.query(sql, [zone_name, postcode_patterns, is_home_zone, zoneId]);
  return rows.length > 0 ? rows[0] : null;
};

const deleteZone = async (zoneId) => {
  // W przyszłości można dodać walidację, czy strefa nie jest używana w żadnym cenniku
  const result = await db.query('DELETE FROM postcode_zones WHERE id = $1', [zoneId]);
  return result.rowCount;
};

const importZones = async (zonesData) => {
  return db.withTransaction(async (client) => {
    const importedZones = [];
    // Używamy ON CONFLICT, aby aktualizować istniejące strefy lub tworzyć nowe
    const sql = `
      INSERT INTO postcode_zones (zone_name, postcode_patterns, is_home_zone)
      VALUES ($1, $2, $3)
      ON CONFLICT (zone_name) DO UPDATE 
      SET postcode_patterns = EXCLUDED.postcode_patterns, is_home_zone = EXCLUDED.is_home_zone, updated_at = NOW()
      RETURNING id;
    `;

    for (const zone of zonesData) {
      // Poprawka: Sprawdzamy, czy dane są stringiem (z CSV) czy już tablicą (z innego źródła).
      let patterns;
      if (typeof zone.postcode_patterns === 'string') {
        patterns = zone.postcode_patterns.split(';').map(p => p.trim()).filter(Boolean);
      } else if (Array.isArray(zone.postcode_patterns)) {
        patterns = zone.postcode_patterns; // Jeśli to już tablica, użyj jej bezpośrednio.
      } else {
        patterns = []; // Domyślnie pusta tablica, jeśli format jest nieznany.
      }
      const isHomeZone = ['true', 'yes', '1'].includes(String(zone.is_home_zone).toLowerCase());

      const result = await client.query(sql, [zone.zone_name, patterns, isHomeZone]);
      if (result.rows.length > 0) {
        importedZones.push(result.rows[0]);
      }
    }
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