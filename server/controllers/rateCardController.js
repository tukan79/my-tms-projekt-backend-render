// Plik: server/controllers/rateCardController.js
const rateCardService = require('../services/rateCardService.js');
const logger = require('../config/logger.js');

const isDebug = process.env.DEBUG === 'true';

/* ---------------------------
   Helpers
--------------------------- */
const parsePositiveInt = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const safeLogSample = (label, obj) => {
  if (!isDebug) return;
  try {
    logger.debug(label, { sample: obj });
  } catch (e) {
    // swallow logging errors
  }
};

const sendServerError = (next, context, err) => {
  logger.error('Internal server error', { context, message: err?.message, stack: err?.stack });
  return next(err);
};

/* ---------------------------
   Controllers
--------------------------- */

exports.getAllRateCards = async (req, res, next) => {
  const context = 'getAllRateCards';
  try {
    logger.info('Request: get all rate cards', { context });
    const rateCards = await rateCardService.findAllRateCards();
    return res.json({ rateCards: rateCards || [] });
  } catch (err) {
    return sendServerError(next, context, err);
  }
};

exports.createRateCard = async (req, res, next) => {
  const context = 'createRateCard';
  try {
    const { name } = req.body;
    if (!name || String(name).trim().length === 0) {
      logger.warn('Invalid create request - missing name', { context });
      return res.status(400).json({ error: 'Rate card "name" is required.' });
    }

    logger.info('Creating rate card', { context, name });
    const created = await rateCardService.createRateCard({ name: String(name).trim() });
    return res.status(201).json(created);
  } catch (err) {
    return sendServerError(next, context, err);
  }
};

exports.updateRateCard = async (req, res, next) => {
  const context = 'updateRateCard';
  try {
    const parsedId = parsePositiveInt(req.params.id);
    if (!parsedId) {
      logger.warn('Invalid update request - bad id', { context, id: req.params.id });
      return res.status(400).json({ error: 'Invalid rate card id' });
    }

    const { name } = req.body;
    if (!name || String(name).trim().length === 0) {
      logger.warn('Invalid update request - missing name', { context, id: parsedId });
      return res.status(400).json({ error: 'Rate card "name" is required.' });
    }

    logger.info('Updating rate card', { context, id: parsedId });
    const updated = await rateCardService.updateRateCard(parsedId, { name: String(name).trim() });

    if (!updated) {
      logger.warn('Rate card not found', { context, id: parsedId });
      return res.status(404).json({ error: 'Rate card not found' });
    }

    return res.json(updated);
  } catch (err) {
    return sendServerError(next, context, err);
  }
};

exports.getEntriesByRateCardId = async (req, res, next) => {
  const context = 'getEntriesByRateCardId';
  try {
    const parsedId = parsePositiveInt(req.params.id);
    if (!parsedId) {
      logger.warn('Invalid entries request - bad id', { context, id: req.params.id });
      return res.status(400).json({ error: 'Invalid rate card id' });
    }

    logger.info('Fetching rate entries', { context, rateCardId: parsedId });
    const entries = await rateCardService.findEntriesByRateCardId(parsedId);
    return res.json({ entries: entries || [] });
  } catch (err) {
    return sendServerError(next, context, err);
  }
};

exports.getCustomersByRateCardId = async (req, res, next) => {
  const context = 'getCustomersByRateCardId';
  try {
    const parsedId = parsePositiveInt(req.params.id);
    if (!parsedId) {
      logger.warn('Invalid customers request - bad id', { context, id: req.params.id });
      return res.status(400).json({ error: 'Invalid rate card id' });
    }

    logger.info('Fetching customers for rate card', { context, rateCardId: parsedId });
    const customers = await rateCardService.findCustomersByRateCardId(parsedId);
    return res.json({ customers: customers || [] });
  } catch (err) {
    return sendServerError(next, context, err);
  }
};

exports.assignCustomer = async (req, res, next) => {
  const context = 'assignCustomer';
  try {
    const rateCardId = parsePositiveInt(req.params.id);
    const customerId = parsePositiveInt(req.params.customerId);

    if (!rateCardId || !customerId) {
      logger.warn('Invalid assign request - missing ids', { context, params: req.params });
      return res.status(400).json({ error: 'Invalid rateCardId or customerId' });
    }

    logger.info('Assigning customer to rate card', { context, rateCardId, customerId });
    const assignment = await rateCardService.assignCustomerToRateCard(rateCardId, customerId);
    return res.status(201).json(assignment);
  } catch (err) {
    return sendServerError(next, context, err);
  }
};

exports.assignCustomersBulk = async (req, res, next) => {
  const context = 'assignCustomersBulk';
  try {
    const rateCardId = parsePositiveInt(req.params.id);
    const { customerIds } = req.body;

    if (!rateCardId) {
      logger.warn('Invalid bulk assign request - bad rateCardId', { context, id: req.params.id });
      return res.status(400).json({ error: 'Invalid rate card id' });
    }

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      logger.warn('Invalid bulk assign request - bad customerIds', { context, rateCardId });
      return res.status(400).json({ error: '"customerIds" must be a non-empty array of numeric ids.' });
    }

    const parsedIds = customerIds.map((c) => parsePositiveInt(c)).filter(Boolean);
    if (parsedIds.length !== customerIds.length) {
      logger.warn('Invalid bulk assign request - some customerIds invalid', { context, rateCardId, originalCount: customerIds.length, parsedCount: parsedIds.length });
      return res.status(400).json({ error: 'All customerIds must be positive integers.' });
    }

    logger.info('Bulk assigning customers', { context, rateCardId, count: parsedIds.length });
    const result = await rateCardService.assignCustomersToRateCardBulk(rateCardId, parsedIds);
    return res.status(201).json(result);
  } catch (err) {
    return sendServerError(next, context, err);
  }
};

exports.unassignCustomer = async (req, res, next) => {
  const context = 'unassignCustomer';
  try {
    const rateCardId = parsePositiveInt(req.params.id);
    const customerId = parsePositiveInt(req.params.customerId);

    if (!rateCardId || !customerId) {
      logger.warn('Invalid unassign request - missing ids', { context, params: req.params });
      return res.status(400).json({ error: 'Invalid rateCardId or customerId' });
    }

    logger.info('Unassigning customer from rate card', { context, rateCardId, customerId });
    await rateCardService.unassignCustomerFromRateCard(rateCardId, customerId);
    return res.status(204).send();
  } catch (err) {
    return sendServerError(next, context, err);
  }
};

exports.importRateEntries = async (req, res, next) => {
  const context = 'importRateEntries';
  try {
    const rateCardId = parsePositiveInt(req.params.id);
    const { entries } = req.body;

    if (!rateCardId) {
      logger.warn('Invalid import request - bad rateCardId', { context, id: req.params.id });
      return res.status(400).json({ error: 'Invalid rate card id' });
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      logger.warn('Invalid import request - entries missing or empty', { context, rateCardId });
      return res.status(400).json({ error: 'Invalid data format. "entries" array is required.' });
    }

    safeLogSample('Import sample entry', entries[0]);
    logger.info('Starting import of rate entries', { context, rateCardId, entryCount: entries.length });

    const result = await rateCardService.importRateEntries(rateCardId, entries);

    logger.info('Import finished', { context, rateCardId, processed: result.count, skipped: result.skipped || 0, errors: result.errors ? result.errors.length : 0 });
    safeLogSample('Import result sample', result);

    return res.status(201).json({ message: `Processed ${result.count} entries.`, ...result });
  } catch (err) {
    return sendServerError(next, context, err);
  }
};

exports.debugZones = async (req, res, next) => {
  const context = 'debugZones';
  try {
    logger.info('Debug zones request', { context });
    const zones = await rateCardService.debugZoneMapping();
    return res.json({ zones: zones || [] });
  } catch (err) {
    return sendServerError(next, context, err);
  }
};

exports.checkZoneMapping = async (req, res, next) => {
  const context = 'checkZoneMapping';
  try {
    const { zoneNames } = req.body;

    if (!Array.isArray(zoneNames) || zoneNames.length === 0) {
      logger.warn('Invalid checkZoneMapping request - zoneNames missing', { context });
      return res.status(400).json({ error: '"zoneNames" must be a non-empty array.' });
    }

    logger.info('Checking zone mapping', { context, requested: zoneNames.length });

    // Delegate heavy work to service
    const zones = await rateCardService.getZoneMappingInfo(); // [{ id, zoneName }, ...]
    const zoneMap = new Map(zones.map(z => [String(z.zoneName).trim().toLowerCase(), z.id]));

    const mapping = zoneNames.map((name) => {
      const key = String(name).trim().toLowerCase();
      const found = zoneMap.has(key);
      return {
        csvZoneName: name,
        foundInDb: found,
        zoneId: found ? zoneMap.get(key) : null,
      };
    });

    const missing = mapping.filter(m => !m.foundInDb);

    return res.json({
      mapping,
      summary: {
        total: zoneNames.length,
        found: zoneNames.length - missing.length,
        missing: missing.length,
        missingZones: missing.map(m => m.csvZoneName),
      },
      availableZones: zones.map(z => ({ id: z.id, name: z.zoneName })),
    });
  } catch (err) {
    return sendServerError(next, context, err);
  }
};
