// server/services/rateCardService.js
const {
  RateCard,
  RateEntry,
  Customer,
  PostcodeZone,
  CustomerRateCardAssignment,
  sequelize,
} = require('../models');
const { Op } = require('sequelize');

const DEFAULT_MAX_ERROR_LOGS = 50;

/* ---------------------------
   Helper logger (unified)
----------------------------*/
const log = (level, context, message, data = null) => {
  const ts = new Date().toISOString();
  const entry = { ts, level, service: 'RateCardService', context, message };
  if (data !== null) entry.data = data;
  // replace with your logger if available
  console.log(JSON.stringify(entry));
};

/* ---------------------------
   Utilities
----------------------------*/
const ensurePositiveInt = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Parse a price-like string or number into a Number (float).
 * Accepts "1,234.56", "1234,56", "£1,234.56", numbers, empty => 0
 */
const parsePrice = (price) => {
  if (price === null || price === undefined || price === '') return 0;
  // if it's already a number
  if (typeof price === 'number' && Number.isFinite(price)) return price;

  const s = String(price).trim();
  if (s === '') return 0;
  // remove currency symbols and spaces
  const cleaned = s.replaceAll(/[^\d,.-]/g, '');
  // if contains both '.' and ',' assume '.' is decimal if '.' appears right-most
  // Simpler approach: replace comma with dot, but handle "1.234,56" -> "1234.56"
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const normalized =
    lastComma > lastDot
      ? cleaned.replaceAll('.', '').replaceAll(',', '.')
      : cleaned.replaceAll(',', '');

  const n = Number.parseFloat(normalized);
  return Number.isNaN(n) ? 0 : n;
};

/**
 * Pick first existing key from object
 */
const findValueByKeys = (obj = {}, keys = []) => {
  const key = keys.find((k) => obj?.[k] !== undefined && obj?.[k] !== null && obj?.[k] !== '');
  if (key === undefined) {
    return undefined;
  }
  return obj[key];
};

/**
 * Normalize one raw import row into a RateEntry payload or return a skip/error reason.
 */
const normalizeImportEntry = (raw, index, zoneMap, processedKeys, rateCardId) => {
  const rowNumber = index + 1;

  const rawZone = findValueByKeys(raw, ['Zone Name', 'zone_name', 'zoneName']) || '';
  const zoneKey = String(rawZone).trim().toLowerCase();
  if (zoneKey.length === 0) {
    return { error: `Row ${rowNumber}: missing zone name` };
  }

  const zoneId = zoneMap.get(zoneKey);
  if (zoneId === undefined) {
    return { error: `Row ${rowNumber}: zone "${rawZone}" not found` };
  }

  let rateTypeRaw = (findValueByKeys(raw, ['Rate Type', 'rate_type', 'rateType']) || 'delivery')
    .toString()
    .trim()
    .toLowerCase();
  if (['standart', 'standard'].includes(rateTypeRaw)) rateTypeRaw = 'delivery';
  rateTypeRaw = rateTypeRaw === 'collection' ? 'collection' : 'delivery';

  const serviceLevel = (findValueByKeys(raw, ['Service Level', 'service_level', 'serviceLevel']) || 'A')
    .toString()
    .trim();
  const uniqueKey = `${zoneId}::${serviceLevel}::${rateTypeRaw}`;
  if (processedKeys.has(uniqueKey)) {
    return { skipped: true };
  }

  const priceFields = {
    priceMicro: parsePrice(findValueByKeys(raw, ['Price Micro', 'price_micro', 'priceMicro'])),
    priceQuarter: parsePrice(findValueByKeys(raw, ['Price Quarter', 'price_quarter', 'priceQuarter'])),
    priceHalf: parsePrice(findValueByKeys(raw, ['Price Half', 'price_half', 'priceHalf'])),
    priceHalfPlus: parsePrice(findValueByKeys(raw, ['Price Half Plus', 'Price Plus Half', 'price_half_plus', 'priceHalfPlus'])),
    priceFull1: parsePrice(findValueByKeys(raw, ['Price Full 1', 'price_full_1', 'priceFull1'])),
    priceFull2: parsePrice(findValueByKeys(raw, ['Price Full 2', 'price_full_2', 'priceFull2'])),
    priceFull3: parsePrice(findValueByKeys(raw, ['Price Full 3', 'price_full_3', 'priceFull3'])),
    priceFull4: parsePrice(findValueByKeys(raw, ['Price Full 4', 'price_full_4', 'priceFull4'])),
    priceFull5: parsePrice(findValueByKeys(raw, ['Price Full 5', 'price_full_5', 'priceFull5'])),
    priceFull6: parsePrice(findValueByKeys(raw, ['Price Full 6', 'price_full_6', 'priceFull6'])),
    priceFull7: parsePrice(findValueByKeys(raw, ['Price Full 7', 'price_full_7', 'priceFull7'])),
    priceFull8: parsePrice(findValueByKeys(raw, ['Price Full 8', 'price_full_8', 'priceFull8'])),
    priceFull9: parsePrice(findValueByKeys(raw, ['Price Full 9', 'price_full_9', 'priceFull9'])),
    priceFull10: parsePrice(findValueByKeys(raw, ['Price Full 10', 'price_full_10', 'priceFull10'])),
  };

  return {
    entry: {
      rateCardId,
      rateType: rateTypeRaw,
      zoneId,
      serviceLevel,
      ...priceFields,
    },
    uniqueKey,
  };
};

const processRateEntries = (entries, zoneMap, rateCardId) => {
  const processedKeys = new Set();
  const entriesToCreate = [];
  let skipped = 0;
  const errors = [];

  entries.forEach((raw, index) => {
    try {
      const normalized = normalizeImportEntry(raw, index, zoneMap, processedKeys, rateCardId);

      if (normalized.error) {
        errors.push(normalized.error);
        skipped++;
        return;
      }

      if (normalized.skipped) {
        skipped++;
        return;
      }

      entriesToCreate.push(normalized.entry);
      if (normalized.uniqueKey) processedKeys.add(normalized.uniqueKey);
    } catch (error_) {
      errors.push(`Row ${index + 1}: ${error_.message}`);
      skipped++;
    }
  });

  return { entriesToCreate, skipped, errors };
};

/* ---------------------------
   Services
----------------------------*/

/**
 * Finds the rate card assigned to a customer.
 */
const findRateCardByCustomerId = async (customerId) => {
  const ctx = 'findRateCardByCustomerId';
  const id = ensurePositiveInt(customerId);
  if (!id) {
    throw new Error('Invalid customerId');
  }
  try {
    log('info', ctx, 'Looking up assignment', { customerId: id });
    const assign = await CustomerRateCardAssignment.findOne({
      where: { customerId: id },
      include: [{ model: RateCard, as: 'rateCard' }],
    });

    if (!assign?.rateCard) {
      log('info', ctx, 'No rate card assignment', { customerId: id });
      return null;
    }
    return assign.rateCard;
  } catch (err) {
    log('error', ctx, 'DB error', { message: err.message });
    throw err;
  }
};

const findAllRateCards = async () => {
  const ctx = 'findAllRateCards';
  try {
    log('info', ctx, 'Fetching all rate cards');
    const rows = await RateCard.findAll({ order: [['name', 'ASC']] });
    return rows;
  } catch (err) {
    log('error', ctx, 'DB error', { message: err.message });
    throw err;
  }
};

const createRateCard = async ({ name }) => {
  const ctx = 'createRateCard';
  if (!name || String(name).trim().length === 0) {
    throw new Error('Rate card name is required');
  }
  const cleanName = String(name).trim();
  try {
    log('info', ctx, 'Creating rate card', { name: cleanName });
    const rc = await RateCard.create({ name: cleanName });
    return rc;
  } catch (err) {
    log('error', ctx, 'Create failed', { message: err.message });
    throw err;
  }
};

const updateRateCard = async (id, { name }) => {
  const ctx = 'updateRateCard';
  const pid = ensurePositiveInt(id);
  if (!pid) throw new Error('Invalid rate card id');
  if (name === undefined) throw new Error('No update fields provided');

  try {
    const [cnt, updated] = await RateCard.update(
      { name: name === null ? null : String(name).trim() },
      { where: { id: pid }, returning: true }
    );
    if (cnt === 0) return null;
    return updated[0];
  } catch (err) {
    log('error', ctx, 'Update failed', { id: pid, message: err.message });
    throw err;
  }
};

const deleteRateCard = async (id) => {
  const ctx = 'deleteRateCard';
  const rcid = ensurePositiveInt(id);
  if (!rcid) throw new Error('Invalid rate card id');

  return sequelize.transaction(async (t) => {
    const existing = await RateCard.findByPk(rcid, { transaction: t });
    if (!existing) {
      return null;
    }

    const assignmentsDeleted = await CustomerRateCardAssignment.destroy({
      where: { rateCardId: rcid },
      transaction: t,
    });
    const entriesDeleted = await RateEntry.destroy({
      where: { rateCardId: rcid },
      transaction: t,
    });

    await existing.destroy({ transaction: t });
    log('info', ctx, 'Deleted rate card and related records', {
      rateCardId: rcid,
      assignmentsDeleted,
      entriesDeleted,
    });
    return { id: rcid, assignmentsDeleted, entriesDeleted };
  });
};

/* ---------------------------
   Import rate entries (CSV -> DB)
   - robust normalization
   - zone name mapping fixed (uses zone.zoneName)
   - collects errors and returns summary
----------------------------*/
const importRateEntries = async (rateCardId, entries = []) => {
  const ctx = 'importRateEntries';
  const rcid = ensurePositiveInt(rateCardId);
  if (!rcid) throw new Error('Invalid rateCardId');
  if (!Array.isArray(entries)) throw new Error('entries must be an array');

  if (entries.length === 0) {
    log('warn', ctx, 'Empty entries array', { rateCardId: rcid });
    return { count: 0, skipped: 0, errors: [] };
  }

  return sequelize.transaction(async (t) => {
    try {
      log('info', ctx, 'Beginning import', { rateCardId: rcid, total: entries.length });

      // Load zones (note: using zoneName attribute)
      const zones = await PostcodeZone.findAll({ attributes: ['id', 'zoneName'], transaction: t });
      const zoneMap = new Map();
      for (const z of zones) {
        const key = String(z.zoneName || '').trim().toLowerCase();
        if (key) zoneMap.set(key, z.id);
      }

      const { entriesToCreate, skipped, errors } = processRateEntries(entries, zoneMap, rcid);

      let createdCount = 0;
      if (entriesToCreate.length > 0) {
        const created = await RateEntry.bulkCreate(entriesToCreate, {
          transaction: t,
          updateOnDuplicate: [
            'priceMicro', 'priceQuarter', 'priceHalf', 'priceHalfPlus',
            'priceFull1', 'priceFull2', 'priceFull3', 'priceFull4', 'priceFull5',
            'priceFull6', 'priceFull7', 'priceFull8', 'priceFull9', 'priceFull10'
          ],
        });
        createdCount = Array.isArray(created) ? created.length : 0;
      }

      // Limit error list to avoid huge responses
      const truncatedErrors = errors.length > DEFAULT_MAX_ERROR_LOGS ? errors.slice(0, DEFAULT_MAX_ERROR_LOGS) : errors;

      log('info', ctx, 'Import summary', { rateCardId: rcid, created: createdCount, skipped, errors: truncatedErrors.length });

      return { count: createdCount, skipped, errors: truncatedErrors };
    } catch (err) {
      log('error', ctx, 'Transaction failed', { message: err.message });
      throw err;
    }
  });
};

const findEntriesByRateCardId = async (rateCardId) => {
  const ctx = 'findEntriesByRateCardId';
  const rcid = ensurePositiveInt(rateCardId);
  if (!rcid) throw new Error('Invalid rateCardId');

  try {
    const rows = await RateEntry.findAll({
      where: { rateCardId: rcid },
      include: [{ model: PostcodeZone, as: 'zone', attributes: ['zoneName'] }],
      order: [['zoneId', 'ASC'], ['serviceLevel', 'ASC']],
    });
    return rows;
  } catch (err) {
    log('error', ctx, 'DB error', { message: err.message });
    throw err;
  }
};

const deleteEntriesByRateCardId = async (rateCardId) => {
  const ctx = 'deleteEntriesByRateCardId';
  const rcid = ensurePositiveInt(rateCardId);
  if (!rcid) throw new Error('Invalid rateCardId');

  const existing = await RateCard.findByPk(rcid);
  if (!existing) {
    return { found: false, deleted: 0 };
  }

  const deleted = await RateEntry.destroy({ where: { rateCardId: rcid } });
  log('info', ctx, 'Deleted rate entries', { rateCardId: rcid, deleted });
  return { found: true, deleted };
};

const findCustomersByRateCardId = async (rateCardId) => {
  const ctx = 'findCustomersByRateCardId';
  const rcid = ensurePositiveInt(rateCardId);
  if (!rcid) throw new Error('Invalid rateCardId');

  try {
    const customers = await Customer.findAll({
      include: [{
        model: CustomerRateCardAssignment,
        as: 'rateCardAssignment',
        where: { rateCardId: rcid },
        required: true,
      }],
      order: [['name', 'ASC']],
    });
    return customers;
  } catch (err) {
    log('error', ctx, 'DB error', { message: err.message });
    throw err;
  }
};

const assignCustomerToRateCard = async (rateCardId, customerId) => {
  const ctx = 'assignCustomerToRateCard';
  const rcid = ensurePositiveInt(rateCardId);
  const cid = ensurePositiveInt(customerId);
  if (!rcid || !cid) throw new Error('Invalid ids');

  try {
    await CustomerRateCardAssignment.upsert({ customerId: cid, rateCardId: rcid });
    return { customerId: cid, rateCardId: rcid };
  } catch (err) {
    log('error', ctx, 'Assign failed', { message: err.message });
    throw err;
  }
};

const unassignCustomerFromRateCard = async (rateCardId, customerId) => {
  const ctx = 'unassignCustomerFromRateCard';
  const rcid = ensurePositiveInt(rateCardId);
  const cid = ensurePositiveInt(customerId);
  if (!rcid || !cid) throw new Error('Invalid ids');

  try {
    const deleted = await CustomerRateCardAssignment.destroy({ where: { customerId: cid, rateCardId: rcid } });
    return deleted;
  } catch (err) {
    log('error', ctx, 'Unassign failed', { message: err.message });
    throw err;
  }
};

const assignCustomersToRateCardBulk = async (rateCardId, customerIds) => {
  const ctx = 'assignCustomersToRateCardBulk';
  const rcid = ensurePositiveInt(rateCardId);
  if (!rcid) throw new Error('Invalid rateCardId');
  if (!Array.isArray(customerIds) || customerIds.length === 0) throw new Error('customerIds array required');

  const parsed = customerIds.map(ensurePositiveInt).filter(Boolean);
  if (parsed.length !== customerIds.length) throw new Error('All customerIds must be positive integers');

  return sequelize.transaction(async (t) => {
    try {
      const payload = parsed.map(cid => ({ customerId: cid, rateCardId: rcid }));
      await CustomerRateCardAssignment.bulkCreate(payload, { transaction: t, updateOnDuplicate: ['rateCardId'] });
      return { count: parsed.length };
    } catch (err) {
      log('error', ctx, 'Bulk assign failed', { message: err.message });
      throw err;
    }
  });
};

const getZoneMappingInfo = async () => {
  const ctx = 'getZoneMappingInfo';
  try {
    const zones = await PostcodeZone.findAll({ attributes: ['id', 'zoneName'], order: [['id', 'ASC']] });
    return zones;
  } catch (err) {
    log('error', ctx, 'Failed to fetch zones', { message: err.message });
    throw err;
  }
};

const debugZoneMapping = async () => {
  // thin wrapper
  return getZoneMappingInfo();
};

/* ---------------------------
   Exports
----------------------------*/
module.exports = {
  findRateCardByCustomerId,
  findAllRateCards,
  createRateCard,
  updateRateCard,
  deleteRateCard,
  parsePrice,
  findValueByKeys,
  importRateEntries,
  findEntriesByRateCardId,
  deleteEntriesByRateCardId,
  findCustomersByRateCardId,
  assignCustomerToRateCard,
  unassignCustomerFromRateCard,
  assignCustomersToRateCardBulk,
  getZoneMappingInfo,
  debugZoneMapping,
};
