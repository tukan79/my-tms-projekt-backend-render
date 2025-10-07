// Plik server/services/rateCardService.js
const db = require('../db/index.js');

// --- Rate Card Logic ---

const createRateCard = async (rateCardData) => {
  const { name } = rateCardData;
  const sql = `INSERT INTO rate_cards (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *`;
  const { rows } = await db.query(sql, [name]);
  return rows[0];
};

const deleteRateCard = async (rateCardId) => {
  const result = await db.query('DELETE FROM rate_cards WHERE id = $1', [rateCardId]);
  return result.rowCount;
};

const findAllRateCards = async () => {
  const { rows } = await db.query('SELECT * FROM rate_cards ORDER BY name');
  return rows;
};

const findCustomersForRateCard = async (rateCardId) => {
  const sql = `SELECT c.id, c.name FROM customers c JOIN customer_rate_card_assignments a ON c.id = a.customer_id WHERE a.rate_card_id = $1`;
  const { rows } = await db.query(sql, [rateCardId]);
  return rows;
};

const assignCustomerToRateCard = async (rateCardId, customerId) => {
  await db.query('INSERT INTO customer_rate_card_assignments (rate_card_id, customer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [rateCardId, customerId]);
};

const unassignCustomerFromRateCard = async (rateCardId, customerId) => {
  await db.query('DELETE FROM customer_rate_card_assignments WHERE rate_card_id = $1 AND customer_id = $2', [rateCardId, customerId]);
};

// --- Rate Entry Logic ---

const createRateEntry = async (rateCardId, entryData) => {
  const {
    rate_type, zone_id, service_level,
    price_micro, price_quarter, price_half, price_half_plus,
    price_full_1, price_full_2, price_full_3, price_full_4, price_full_5, 
    price_full_6, price_full_7, price_full_8, price_full_9, price_full_10
  } = entryData;
  const sql = `
    INSERT INTO rate_entries (
      rate_card_id, rate_type, zone_id, service_level,
      price_micro, price_quarter, price_half, price_half_plus,
      price_full_1, price_full_2, price_full_3, price_full_4, price_full_5,
      price_full_6, price_full_7, price_full_8, price_full_9, price_full_10
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *
  `;
  const { rows } = await db.query(sql, [
    rateCardId, rate_type, zone_id, service_level,
    price_micro, price_quarter, price_half, price_half_plus,
    price_full_1, price_full_2, price_full_3, price_full_4, price_full_5,
    price_full_6, price_full_7, price_full_8, price_full_9, price_full_10
  ]);
  return rows[0];
};

const findRateEntriesByCard = async (rateCardId) => {
  const { rows } = await db.query('SELECT * FROM rate_entries WHERE rate_card_id = $1', [rateCardId]);
  return rows;
};

const enrichRateEntriesWithZoneNames = async (entries) => {
  const zoneIds = [...new Set(entries.map(e => e.zone_id).filter(Boolean))];
  if (zoneIds.length === 0) {
    return entries.map(e => ({ ...e, zone_name: '' }));
  }

  const { rows: zones } = await db.query('SELECT id, zone_name FROM postcode_zones WHERE id = ANY($1)', [zoneIds]);
  const zoneMap = new Map(zones.map(z => [z.id, z.zone_name]));

  return entries.map(entry => ({
    ...entry,
    zone_name: zoneMap.get(entry.zone_id) || '',
  }));
};

const updateRateEntry = async (entryId, entryData) => {
  const { 
    price_micro, price_quarter, price_half, price_half_plus,
    price_full_1, price_full_2, price_full_3, price_full_4, price_full_5, 
    price_full_6, price_full_7, price_full_8, price_full_9, price_full_10
  } = entryData;
  const sql = `
    UPDATE rate_entries
    SET price_micro = $1, price_quarter = $2, price_half = $3, price_half_plus = $4,
        price_full_1 = $5, price_full_2 = $6, price_full_3 = $7, price_full_4 = $8, price_full_5 = $9,
        price_full_6 = $10, price_full_7 = $11, price_full_8 = $12, price_full_9 = $13, price_full_10 = $14
    WHERE id = $15 RETURNING *
  `;
  const { rows } = await db.query(sql, [
    price_micro, price_quarter, price_half, price_half_plus,
    price_full_1, price_full_2, price_full_3, price_full_4, price_full_5,
    price_full_6, price_full_7, price_full_8, price_full_9, price_full_10, entryId
  ]);
  return rows.length > 0 ? rows[0] : null;
};

const deleteRateEntry = async (entryId) => {
  const result = await db.query('DELETE FROM rate_entries WHERE id = $1', [entryId]);
  return result.rowCount;
};

const importRateEntries = async (rateCardId, entriesData) => {
  return db.withTransaction(async (client) => {
    let processedCount = 0;
    const errors = [];

    // Pobierz wszystkie strefy, aby móc mapować nazwy na ID
    const { rows: allZones } = await client.query('SELECT id, zone_name FROM postcode_zones');
    const zoneMap = new Map(allZones.map(z => [z.zone_name.toLowerCase(), z.id]));

    const sql = `
      INSERT INTO rate_entries (
        rate_card_id, rate_type, zone_id, service_level,
        price_micro, price_quarter, price_half, price_half_plus,
        price_full_1, price_full_2, price_full_3, price_full_4, price_full_5,
        price_full_6, price_full_7, price_full_8, price_full_9, price_full_10
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (rate_card_id, rate_type, zone_id, service_level) DO UPDATE SET
        price_micro = EXCLUDED.price_micro,
        price_quarter = EXCLUDED.price_quarter,
        price_half = EXCLUDED.price_half,
        price_half_plus = EXCLUDED.price_half_plus,
        price_full_1 = EXCLUDED.price_full_1,
        price_full_2 = EXCLUDED.price_full_2,
        price_full_3 = EXCLUDED.price_full_3,
        price_full_4 = EXCLUDED.price_full_4,
        price_full_5 = EXCLUDED.price_full_5,
        price_full_6 = EXCLUDED.price_full_6,
        price_full_7 = EXCLUDED.price_full_7,
        price_full_8 = EXCLUDED.price_full_8,
        price_full_9 = EXCLUDED.price_full_9,
        price_full_10 = EXCLUDED.price_full_10;
    `;

    for (const [index, entry] of entriesData.entries()) {
      const rate_type = entry['Rate Type']?.toLowerCase();
      const zone_name = entry['Zone Name']?.trim();
      const service_level = entry['Service Level'];

      if (!rate_type || !zone_name || !service_level) {
        errors.push({ line: index + 2, message: 'Missing required fields: Rate Type, Zone Name, or Service Level.' });
        continue;
      }

      const zone_id = zoneMap.get(zone_name.toLowerCase().trim());
      if (!zone_id) {
        errors.push({ line: index + 2, message: `Zone '${zone_name}' not found.` });
        continue;
      }

      const toNumeric = (value) => (value === '' || value === null || value === undefined) ? null : parseFloat(value);
      
      const rateTypesToInsert = [];
      // Poprawka: obsługa 'standart' (z literówką) oraz 'standard'
      if (rate_type === 'standard' || rate_type === 'standart') {
        rateTypesToInsert.push('collection', 'delivery');
      } else if (rate_type === 'collection' || rate_type === 'delivery') {
        rateTypesToInsert.push(rate_type);
      } else {
        errors.push({ line: index + 2, message: `Invalid Rate Type '${entry['Rate Type']}'. Must be 'Standard', 'Collection', or 'Delivery'.` });
        continue;
      }

      for (const type of rateTypesToInsert) {
        const result = await client.query(sql, [
          rateCardId, type, zone_id, service_level,
          toNumeric(entry['Price Micro']), toNumeric(entry['Price Quarter']), toNumeric(entry['Price Half']), toNumeric(entry['Price Half Plus']),
          toNumeric(entry['Price Full 1']), toNumeric(entry['Price Full 2']), toNumeric(entry['Price Full 3']), toNumeric(entry['Price Full 4']), toNumeric(entry['Price Full 5']),
          toNumeric(entry['Price Full 6']), toNumeric(entry['Price Full 7']), toNumeric(entry['Price Full 8']), toNumeric(entry['Price Full 9']), toNumeric(entry['Price Full 10']),
        ]);
        // Poprawka: zliczaj tylko faktycznie dodane/zaktualizowane wiersze
        if (result.rowCount > 0) {
          processedCount++;
        }
      }
    }
    return { processedCount, errors };
  });
};

module.exports = {
  createRateCard,
  findAllRateCards,
  deleteRateCard,
  findCustomersForRateCard,
  assignCustomerToRateCard,
  unassignCustomerFromRateCard,
  createRateEntry,
  findRateEntriesByCard,
  enrichRateEntriesWithZoneNames,
  updateRateEntry,
  deleteRateEntry,
  importRateEntries,
};