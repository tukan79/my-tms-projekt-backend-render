const db = require('../db/index.js');

// Helper function for consistent logging within the service
const logService = (level, context, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    context: `RateCardService.${context}`,
    message
  };
  if (data) {
    logEntry.data = data;
  }
  console.log(JSON.stringify(logEntry, null, 2));
};
/**
 * Finds the rate card assigned to a specific customer.
 * @param {number} customerId - The ID of the customer.
 * @returns {Promise<object|null>} The rate card object or null if not found.
 */
const findRateCardByCustomerId = async (customerId) => {
  const context = 'findRateCardByCustomerId';
  try {
    logService('INFO', context, 'Finding rate card for customer', { customerId });
    const assignmentSql = `SELECT rate_card_id FROM customer_rate_card_assignments WHERE customer_id = $1 LIMIT 1`;
    const assignmentResult = await db.query(assignmentSql, [customerId]);

    if (assignmentResult.rows.length === 0) {
      logService('INFO', context, 'No rate card assignment found for customer', { customerId });
      return null;
    }

    const rateCardId = assignmentResult.rows[0].rate_card_id;
    logService('DEBUG', context, 'Found rate card assignment', { customerId, rateCardId });

    const rateCardSql = `SELECT * FROM rate_cards WHERE id = $1`;
    const rateCardResult = await db.query(rateCardSql, [rateCardId]);

    const result = rateCardResult.rows[0] || null;
    logService('INFO', context, 'Rate card retrieval completed', { customerId, found: !!result });
    return result;
  } catch (error) {
    logService('ERROR', context, 'Error finding rate card by customer ID', { customerId, error: error.message });
    throw error;
  }
};

/**
 * Finds all available rate cards.
 * @returns {Promise<Array>} A list of all rate cards.
 */
const findAllRateCards = async () => {
  const context = 'findAllRateCards';
  try {
    logService('INFO', context, 'Fetching all rate cards');
    const sql = `SELECT * FROM rate_cards ORDER BY name`;
    const { rows } = await db.query(sql);
    logService('INFO', context, 'Successfully fetched rate cards', { count: rows.length });
    return rows;
  } catch (error) {
    logService('ERROR', context, 'Error finding all rate cards', { error: error.message });
    throw error;
  }
};

const createRateCard = async ({ name }) => {
  const context = 'createRateCard';
  try {
    if (!name || name.trim() === '') {
      throw new Error('Rate card name is required');
    }

    logService('INFO', context, 'Creating new rate card', { name });
    const sql = `
      INSERT INTO rate_cards (name)
      VALUES ($1) 
      RETURNING *
    `;
    const { rows } = await db.query(sql, [name.trim()]);
    logService('INFO', context, 'Successfully created rate card', { id: rows[0].id, name: rows[0].name });
    return rows[0];
  } catch (error) {
    logService('ERROR', context, 'Error creating rate card', { error: error.message, name });
    throw error;
  }
};

const updateRateCard = async (id, { name, price }) => {
  const context = 'updateRateCard';
  try {
    logService('INFO', context, 'Updating rate card', { id, updates: { name, price } });
    
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      params.push(name);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      params.push(price);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const sql = `
      UPDATE rate_cards 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const { rows } = await db.query(sql, params);
    if (rows.length === 0) {
      throw new Error('Rate card not found');
    }
    
    logService('INFO', context, 'Successfully updated rate card', { id: rows[0].id });
    return rows[0];
  } catch (error) {
    logService('ERROR', context, 'Error updating rate card', { id, error: error.message });
    throw error;
  }
};

/**
 * Converts price string to micro units (integer)
 * @param {string} priceStr - Price as string with possible commas
 * @returns {number} Price in micro units
 */
const parsePrice = (priceStr) => {
  if (priceStr === null || priceStr === undefined || priceStr === '') return 0;

  // Usuń wszystkie znaki niebędące cyframi, kropkami lub przecinkami
  const cleanStr = String(priceStr).replace(/[^\d.,-]/g, '');

  // Zamień przecinek na kropkę
  const numericValue = parseFloat(cleanStr.replace(',', '.'));

  return isNaN(numericValue) ? 0 : numericValue;
};

/**
 * Finds a value in an object by trying multiple keys.
 * @param {object} obj - The object to search in.
 * @param {string[]} keys - An array of keys to try.
 * @returns {any|undefined} The value of the first found key, or undefined.
 */
const findValueByKeys = (obj, keys) => {
  for (const key of keys) if (obj[key] !== undefined) return obj[key];
};

const importRateEntries = async (rateCardId, entries) => {
  const context = 'importRateEntries';
  
  // Walidacja wejścia
  if (!rateCardId || !entries || !Array.isArray(entries)) {
    throw new Error('Invalid input: rateCardId and entries array are required');
  }

  if (entries.length === 0) {
    logService('WARN', context, 'Empty entries array provided', { rateCardId });
    return { count: 0, skipped: 0, errors: [] };
  }

  return db.withTransaction(async (client) => {
    try {
      logService('INFO', context, 'Starting transaction for rate entries import', { 
        rateCardId, 
        totalEntries: entries.length 
      });

      // Pobierz wszystkie strefy
      logService('DEBUG', context, 'Fetching zones from database');
      const { rows: zones } = await client.query('SELECT id, zone_name FROM postcode_zones');
      logService('DEBUG', context, `Retrieved ${zones.length} zones from database`);

      // Tworzymy mapowanie nazw stref na ID - POPRAWIONE MAPOWANIE
      const zoneMap = new Map();
      // Uproszczone i bardziej niezawodne mapowanie: konwertujemy nazwy na małe litery i usuwamy białe znaki.
      zones.forEach(zone => {
        zoneMap.set(String(zone.zone_name).trim().toLowerCase(), zone.id);
      });

      logService('DEBUG', context, 'Zone mapping created', { 
        zoneMapSize: zoneMap.size,
        sampleMappings: Array.from(zoneMap.entries()).slice(0, 10).map(([key, value]) => `${key} -> ${value}`)
      });

      const sql = `
        INSERT INTO rate_entries (
          rate_card_id, rate_type, zone_id, service_level,
          price_micro, price_quarter, price_half, price_half_plus,
          price_full_1, price_full_2, price_full_3, price_full_4, price_full_5,
          price_full_6, price_full_7, price_full_8, price_full_9, price_full_10
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
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

      let processedCount = 0;
      let skippedCount = 0;
      const errors = [];
      const processedKeys = new Set(); // Zestaw do śledzenia unikalnych kluczy

      for (const [index, entry] of entries.entries()) {
        try {
          // Mapowanie nazw kolumn z CSV na nasze pola
          // Używamy tej samej logiki normalizacji, co przy tworzeniu mapy.
          const zoneNameFromCSV = String(entry['Zone Name'] || '').trim().toLowerCase();
          const zoneId = zoneMap.get(zoneNameFromCSV);

          if (!zoneId) {
            const errorMsg = `Zone "${entry['Zone Name']}" not found in database. Available zones: ${Array.from(zoneMap.keys()).slice(0, 10).join(', ')}...`;
            errors.push(errorMsg);
            skippedCount++;
            continue;
          }

          logService('DEBUG', context, `Processing entry ${index}`, {
            zoneName: zoneNameFromCSV,
            zoneId,
            rateType: entry['Rate Type'],
            serviceLevel: entry['Service Level']
          });

          let rateType = (entry['Rate Type'] || 'delivery').trim().toLowerCase();
          if (rateType === 'standart' || rateType === 'standard') { // Poprawka: Obsługa błędnej pisowni "Standart"
            rateType = 'delivery';
          } else if (rateType !== 'collection') {
            rateType = 'delivery'; // Domyślnie ustawiamy na 'delivery', jeśli wartość jest nieznana lub inna
          }

          const serviceLevel = entry['Service Level'] || 'A'; // Pobieramy serviceLevel z wpisu
          // Klucz unikalności dla wpisu
          const uniqueKey = `${zoneId}-${serviceLevel}-${rateType}`;
          if (processedKeys.has(uniqueKey)) {
            logService('WARN', context, `Skipping duplicate entry in CSV file for key: ${uniqueKey}`, { index });
            skippedCount++;
            continue;
          }

          const params = [
            rateCardId,
            rateType,
            zoneId,
            serviceLevel,
            parsePrice(findValueByKeys(entry, ['Price Micro', 'price_micro'])),
            parsePrice(findValueByKeys(entry, ['Price Quarter', 'price_quarter'])),
            parsePrice(findValueByKeys(entry, ['Price Half', 'price_half'])),
            parsePrice(findValueByKeys(entry, ['Price Half Plus', 'Price Plus Half', 'price_half_plus'])),
            parsePrice(findValueByKeys(entry, ['Price Full 1', 'price_full_1'])),
            parsePrice(findValueByKeys(entry, ['Price Full 2', 'price_full_2'])),
            parsePrice(findValueByKeys(entry, ['Price Full 3', 'price_full_3'])),
            parsePrice(findValueByKeys(entry, ['Price Full 4', 'price_full_4'])),
            parsePrice(findValueByKeys(entry, ['Price Full 5', 'price_full_5'])),
            parsePrice(findValueByKeys(entry, ['Price Full 6', 'price_full_6'])),
            parsePrice(findValueByKeys(entry, ['Price Full 7', 'price_full_7'])),
            parsePrice(findValueByKeys(entry, ['Price Full 8', 'price_full_8'])),
            parsePrice(findValueByKeys(entry, ['Price Full 9', 'price_full_9'])),
            parsePrice(findValueByKeys(entry, ['Price Full 10', 'price_full_10'])),
          ];

          await client.query(sql, params);
          processedKeys.add(uniqueKey); // Dodaj klucz do przetworzonych
          processedCount++;
          
          if (processedCount % 50 === 0) {
            logService('INFO', context, `Processed ${processedCount} entries`, { rateCardId });
          }
        } catch (entryError) {
          const errorMsg = `Error processing entry ${index} for zone ${entry['Zone Name']}: ${entryError.message}`;
          errors.push(errorMsg);
          skippedCount++;
          logService('ERROR', context, errorMsg);
        }
      }

      // Logowanie podsumowania
      logService('INFO', context, 'Import transaction completed', {
        rateCardId,
        processed: processedCount,
        skipped: skippedCount,
        totalErrors: errors.length
      });

      if (errors.length > 0) {
        logService('WARN', context, 'Import completed with errors', {
          rateCardId,
          firstErrors: errors.slice(0, 5)
        });
      }

      return { 
        count: processedCount, 
        skipped: skippedCount,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined
      };
    } catch (error) {
      logService('ERROR', context, 'Transaction failed', { 
        rateCardId, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  });
};

const findEntriesByRateCardId = async (rateCardId) => {
  const context = 'findEntriesByRateCardId';
  try {
    logService('INFO', context, 'Finding rate entries for rate card', { rateCardId });
    const sql = `
      SELECT re.*, pz.zone_name 
      FROM rate_entries re
      LEFT JOIN postcode_zones pz ON re.zone_id = pz.id
      WHERE re.rate_card_id = $1 
      ORDER BY re.zone_id, re.service_level
    `;
    const { rows } = await db.query(sql, [rateCardId]);
    logService('INFO', context, 'Found rate entries', { rateCardId, count: rows.length });
    return rows;
  } catch (error) {
    logService('ERROR', context, 'Error finding rate entries', { rateCardId, error: error.message });
    throw error;
  }
};

const findCustomersByRateCardId = async (rateCardId) => {
  const context = 'findCustomersByRateCardId';
  try {
    logService('INFO', context, 'Finding customers for rate card', { rateCardId });
    const sql = `
      SELECT c.id, c.name, c.customer_code 
      FROM customers c
      JOIN customer_rate_card_assignments crca ON c.id = crca.customer_id
      WHERE crca.rate_card_id = $1
      ORDER BY c.name;
    `;
    const { rows } = await db.query(sql, [rateCardId]);
    logService('INFO', context, 'Found customers for rate card', { rateCardId, count: rows.length });
    return rows;
  } catch (error) {
    logService('ERROR', context, 'Error finding customers by rate card', { rateCardId, error: error.message });
    throw error;
  }
};

const assignCustomerToRateCard = async (rateCardId, customerId) => {
  const context = 'assignCustomerToRateCard';
  try {
    logService('INFO', context, 'Assigning customer to rate card', { rateCardId, customerId });
    const sql = `
      INSERT INTO customer_rate_card_assignments (customer_id, rate_card_id)
      VALUES ($1, $2)
      ON CONFLICT (customer_id) DO UPDATE
      SET rate_card_id = EXCLUDED.rate_card_id
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [customerId, rateCardId]);
    logService('INFO', context, 'Successfully assigned customer to rate card', { rateCardId, customerId });
    return rows[0];
  } catch (error) {
    logService('ERROR', context, 'Error assigning customer to rate card', { rateCardId, customerId, error: error.message });
    throw error;
  }
};

const unassignCustomerFromRateCard = async (rateCardId, customerId) => {
  const context = 'unassignCustomerFromRateCard';
  try {
    logService('INFO', context, 'Unassigning customer from rate card', { rateCardId, customerId });
    const sql = `DELETE FROM customer_rate_card_assignments WHERE customer_id = $1 AND rate_card_id = $2`;
    const result = await db.query(sql, [customerId, rateCardId]);
    logService('INFO', context, 'Successfully unassigned customer from rate card', { 
      rateCardId, 
      customerId, 
      rowCount: result.rowCount 
    });
    return result.rowCount;
  } catch (error) {
    logService('ERROR', context, 'Error unassigning customer from rate card', { rateCardId, customerId, error: error.message });
    throw error;
  }
};

const assignCustomersToRateCardBulk = async (rateCardId, customerIds) => {
  const context = 'assignCustomersToRateCardBulk';
  logService('INFO', context, 'Bulk assigning customers to rate card', { rateCardId, customerIds });

  if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
    throw new Error('An array of customer IDs is required.');
  }

  return db.withTransaction(async (client) => {
    const sql = `
      INSERT INTO customer_rate_card_assignments (customer_id, rate_card_id)
      VALUES ($1, $2)
      ON CONFLICT (customer_id) DO UPDATE
      SET rate_card_id = EXCLUDED.rate_card_id;
    `;

    const results = [];
    for (const customerId of customerIds) {
      const result = await client.query(sql, [customerId, rateCardId]);
      results.push(result);
    }

    logService('INFO', context, `Successfully assigned ${results.length} customers.`, { rateCardId });
    return { count: results.length };
  });
};

// Dodatkowa funkcja do sprawdzenia struktury stref w bazie
const getZoneMappingInfo = async () => {
  const context = 'getZoneMappingInfo';
  try {
    logService('INFO', context, 'Fetching zone mapping info');
    const sql = `SELECT id, zone_name FROM postcode_zones ORDER BY id`;
    const { rows } = await db.query(sql);
    logService('INFO', context, 'Retrieved zone mapping info', { count: rows.length });
    return rows;
  } catch (error) {
    logService('ERROR', context, 'Error getting zone mapping info', { error: error.message });
    throw error;
  }
};

// Funkcja do debugowania - sprawdź jakie strefy są dostępne
const debugZoneMapping = async () => {
  const context = 'debugZoneMapping';
  try {
    logService('INFO', context, 'Debugging zone mapping');
    const zones = await getZoneMappingInfo();
    logService('INFO', context, 'Zone mapping debug completed', { zoneCount: zones.length });
    return zones;
  } catch (error) {
    logService('ERROR', context, 'Error debugging zone mapping', { error: error.message });
    throw error;
  }
};

module.exports = {
  findRateCardByCustomerId,
  findAllRateCards,
  createRateCard,
  updateRateCard,
  importRateEntries,
  findEntriesByRateCardId,
  findCustomersByRateCardId,
  assignCustomerToRateCard,
  unassignCustomerFromRateCard,
  assignCustomersToRateCardBulk,
  getZoneMappingInfo,
  debugZoneMapping,
  parsePrice
};