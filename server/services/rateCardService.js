const { RateCard, RateEntry, Customer, PostcodeZone, CustomerRateCardAssignment, sequelize } = require('../models');
const { Op } = require('sequelize');

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
    const assignment = await CustomerRateCardAssignment.findOne({
      where: { customerId },
      include: [{ model: RateCard, as: 'rateCard' }]
    });

    if (!assignment?.rateCard) {
      logService('INFO', context, 'No rate card assignment found for customer', { customerId });
      return null;
    }

    const rateCard = assignment.rateCard;
    logService('INFO', context, 'Rate card retrieval completed', { customerId, found: !!rateCard });
    return rateCard;
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
    const rateCards = await RateCard.findAll({
      order: [['name', 'ASC']]
    });
    logService('INFO', context, 'Successfully fetched rate cards', { count: rateCards.length });
    return rateCards;
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

    logService('INFO', context, 'Creating new rate card', { name: name.trim() });
    const newRateCard = await RateCard.create({ name: name.trim() });
    logService('INFO', context, 'Successfully created rate card', { id: newRateCard.id, name: newRateCard.name });
    return newRateCard;
  } catch (error) {
    logService('ERROR', context, 'Error creating rate card', { error: error.message, name });
    throw error;
  }
};

const updateRateCard = async (id, { name }) => {
  const context = 'updateRateCard';
  try {
    logService('INFO', context, 'Updating rate card', { id, updates: { name } });
    
    if (name === undefined) {
      throw new Error('No fields to update');
    }

    const [updatedRowsCount, updatedRateCards] = await RateCard.update(
      { name },
      {
        where: { id },
        returning: true,
      }
    );

    if (updatedRowsCount === 0) return null;
    
    logService('INFO', context, 'Successfully updated rate card', { id: updatedRateCards[0].id });
    return updatedRateCards[0];
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

  const cleanStr = String(priceStr).replaceAll(/[^\d.,-]/g, '');
  const numericValue = Number.parseFloat(cleanStr.replace(',', '.'));

  return Number.isNaN(numericValue) ? 0 : numericValue;
};

/**
 * Finds a value in an object by trying multiple keys.
 * @param {object} obj - The object to search in.
 * @param {string[]} keys - An array of keys to try.
 * @returns {any|undefined} The value of the first found key, or undefined.
 */
const findValueByKeys = (obj, keys) => {
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
};

const importRateEntries = async (rateCardId, entries) => {
  const context = 'importRateEntries';
  
  if (!rateCardId || !entries || !Array.isArray(entries)) {
    throw new Error('Invalid input: rateCardId and entries array are required');
  }

  if (entries.length === 0) {
    logService('WARN', context, 'Empty entries array provided', { rateCardId });
    return { count: 0, skipped: 0, errors: [] };
  }

  return sequelize.transaction(async (t) => {
    try {
      logService('INFO', context, 'Starting transaction for rate entries import', { 
        rateCardId, 
        totalEntries: entries.length 
      });

      const zones = await PostcodeZone.findAll({
        attributes: ['id', 'zoneName'],
        transaction: t
      });

      const zoneMap = new Map();
      zones.forEach(zone => {
        zoneMap.set(String(zone.zone_name).trim().toLowerCase(), zone.id);
      });

      let skippedCount = 0;
      const errors = [];
      const processedKeys = new Set();
      const entriesToCreate = [];

      for (const [index, entry] of entries.entries()) {
        try {
          const zoneNameFromCSV = String(entry['Zone Name'] || '').trim().toLowerCase();
          const zoneId = zoneMap.get(zoneNameFromCSV);

          if (!zoneId) {
            const errorMsg = `Zone "${entry['Zone Name']}" not found in database.`;
            errors.push(errorMsg);
            skippedCount++;
            continue;
          }

          let rateType = (entry['Rate Type'] || 'delivery').trim().toLowerCase();
          if (rateType === 'standart' || rateType === 'standard') {
            rateType = 'delivery';
          } else if (rateType !== 'collection') {
            rateType = 'delivery';
          }

          const serviceLevel = entry['Service Level'] || 'A';
          const uniqueKey = `${zoneId}-${serviceLevel}-${rateType}`;

          if (processedKeys.has(uniqueKey)) {
            skippedCount++;
            continue;
          }

          entriesToCreate.push({
            rateCardId,
            rateType,
            zoneId,
            serviceLevel,
            priceMicro: parsePrice(findValueByKeys(entry, ['Price Micro', 'price_micro'])),
            priceQuarter: parsePrice(findValueByKeys(entry, ['Price Quarter', 'price_quarter'])),
            priceHalf: parsePrice(findValueByKeys(entry, ['Price Half', 'price_half'])),
            priceHalfPlus: parsePrice(findValueByKeys(entry, ['Price Half Plus', 'Price Plus Half', 'price_half_plus'])),
            priceFull1: parsePrice(findValueByKeys(entry, ['Price Full 1', 'price_full_1'])),
            priceFull2: parsePrice(findValueByKeys(entry, ['Price Full 2', 'price_full_2'])),
            priceFull3: parsePrice(findValueByKeys(entry, ['Price Full 3', 'price_full_3'])),
            priceFull4: parsePrice(findValueByKeys(entry, ['Price Full 4', 'price_full_4'])),
            priceFull5: parsePrice(findValueByKeys(entry, ['Price Full 5', 'price_full_5'])),
            priceFull6: parsePrice(findValueByKeys(entry, ['Price Full 6', 'price_full_6'])),
            priceFull7: parsePrice(findValueByKeys(entry, ['Price Full 7', 'price_full_7'])),
            priceFull8: parsePrice(findValueByKeys(entry, ['Price Full 8', 'price_full_8'])),
            priceFull9: parsePrice(findValueByKeys(entry, ['Price Full 9', 'price_full_9'])),
            priceFull10: parsePrice(findValueByKeys(entry, ['Price Full 10', 'price_full_10'])),
          });

          processedKeys.add(uniqueKey);

        } catch (entryError) {
          const errorMsg = `Error processing entry ${index}: ${entryError.message}`;
          errors.push(errorMsg);
          skippedCount++;
        }
      }

      let processedCount = 0;

      if (entriesToCreate.length > 0) {
        const createdEntries = await RateEntry.bulkCreate(entriesToCreate, {
          transaction: t,
          updateOnDuplicate: [
            'priceMicro', 'priceQuarter', 'priceHalf', 'priceHalfPlus',
            'priceFull1', 'priceFull2', 'priceFull3', 'priceFull4', 'priceFull5',
            'priceFull6', 'priceFull7', 'priceFull8', 'priceFull9', 'priceFull10'
          ],
        });
        processedCount = createdEntries.length;
      }

      return { 
        count: processedCount, 
        skipped: skippedCount,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined
      };
    } catch (error) {
      logService('ERROR', context, 'Error message here', { error: error.message });
      throw error;
}
  });
};

const findEntriesByRateCardId = async (rateCardId) => {
  const context = 'findEntriesByRateCardId';
  try {
    logService('INFO', context, 'Finding rate entries for rate card', { rateCardId });
    const entries = await RateEntry.findAll({
      where: { rateCardId },
      include: [{ model: PostcodeZone, as: 'zone', attributes: ['zoneName'] }],
      order: [['zoneId', 'ASC'], ['serviceLevel', 'ASC']],
      raw: true,
    });
    logService('INFO', context, 'Found rate entries', { rateCardId, count: entries.length });
    return entries;
  } catch (error) {
    logService('ERROR', context, 'Error finding rate entries', { rateCardId, error: error.message });
    throw error;
  }
};

const findCustomersByRateCardId = async (rateCardId) => {
  const context = 'findCustomersByRateCardId';
  try {
    logService('INFO', context, 'Finding customers for rate card', { rateCardId });
    const customers = await Customer.findAll({
      include: [{
        model: CustomerRateCardAssignment,
        as: 'rateCardAssignment',
        where: { rateCardId },
        required: true,
      }],
      order: [['name', 'ASC']],
    });
    logService('INFO', context, 'Found customers for rate card', { rateCardId, count: customers.length });
    return customers;
  } catch (error) {
    logService('ERROR', context, 'Error finding customers by rate card', { rateCardId, error: error.message });
    throw error;
  }
};

const assignCustomerToRateCard = async (rateCardId, customerId) => {
  const context = 'assignCustomerToRateCard';
  try {
    logService('INFO', context, 'Assigning customer to rate card', { rateCardId, customerId });

    // FIXED: removed invalid empty destructuring
    await CustomerRateCardAssignment.upsert({
      customerId,
      rateCardId,
    });

    logService('INFO', context, 'Successfully assigned customer to rate card', { rateCardId, customerId });

    return { customerId, rateCardId };
  } catch (error) {
    logService('ERROR', context, 'Error assigning customer to rate card', { rateCardId, customerId, error: error.message });
    throw error;
  }
};

const unassignCustomerFromRateCard = async (rateCardId, customerId) => {
  const context = 'unassignCustomerFromRateCard';
  try {
    logService('INFO', context, 'Unassigning customer from rate card', { rateCardId, customerId });
    const deletedCount = await CustomerRateCardAssignment.destroy({ where: { customerId, rateCardId } });
    logService('INFO', context, 'Successfully unassigned customer from rate card', { 
      rateCardId, 
      customerId, 
      rowCount: deletedCount 
    });
    return deletedCount;
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

  return sequelize.transaction(async (t) => {
    const assignments = customerIds.map(customerId => ({ customerId, rateCardId }));
    
    const results = await CustomerRateCardAssignment.bulkCreate(assignments, {
      transaction: t,
      updateOnDuplicate: ['rateCardId'],
    });

    const count = results.length;
    logService('INFO', context, `Successfully assigned ${count} customers.`, { rateCardId });
    return { count };
  });
};

const getZoneMappingInfo = async () => {
  const context = 'getZoneMappingInfo';
  try {
    logService('INFO', context, 'Fetching zone mapping info');
    const zones = await PostcodeZone.findAll({
      attributes: ['id', 'zoneName'],
      order: [['id', 'ASC']]
    });
    logService('INFO', context, 'Retrieved zone mapping info', { count: zones.length });
    return zones;
  } catch (error) {
    logService('ERROR', context, 'Error getting zone mapping info', { error: error.message });
    throw error;
  }
};

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
  parsePrice,
  findValueByKeys,
  importRateEntries,
  findEntriesByRateCardId,
  findCustomersByRateCardId,
  assignCustomerToRateCard,
  unassignCustomerFromRateCard,
  assignCustomersToRateCardBulk,
  getZoneMappingInfo,
  debugZoneMapping,
};
