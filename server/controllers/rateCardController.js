// Plik: server/controllers/rateCardController.js
const rateCardService = require('../services/rateCardService.js');
const util = require('util'); // Importujemy moduł 'util'
const logger = require('../config/logger.js'); // Używamy standardowego loggera

exports.getAllRateCards = async (req, res, next) => {
  const context = 'getAllRateCards';
  try {
    logger.info('Fetching all rate cards', { context });
    const rateCards = await rateCardService.findAllRateCards();
    logger.info(`Successfully fetched ${rateCards.length} rate cards`, { context });
    res.json(rateCards);
  } catch (error) {
    logger.error('Error fetching rate cards', { context, error: error.message });
    next(error);
  }
};

exports.createRateCard = async (req, res, next) => {
  const context = 'createRateCard';
  try {
    logger.info('Creating new rate card', { context, body: req.body });
    const newRateCard = await rateCardService.createRateCard(req.body);
    logger.info('Successfully created rate card', { context, id: newRateCard.id, name: newRateCard.name });
    res.status(201).json(newRateCard);
  } catch (error) {
    logger.error('Error creating rate card', { context, error: error.message, body: req.body });
    next(error);
  }
};

exports.updateRateCard = async (req, res, next) => {
  const context = 'updateRateCard';
  try {
    const { id } = req.params;
    logger.info('Updating rate card', { context, id, updates: req.body });
    const updatedRateCard = await rateCardService.updateRateCard(id, req.body);
    if (!updatedRateCard) {
      logger.warn('Rate card not found', { context, id });
      return res.status(404).json({ error: 'Rate card not found' });
    }
    logger.info('Successfully updated rate card', { context, id: updatedRateCard.id });
    res.json(updatedRateCard);
  } catch (error) {
    logger.error('Error updating rate card', { context, error: error.message, id: req.params.id, body: req.body });
    next(error);
  }
};

exports.getEntriesByRateCardId = async (req, res, next) => {
  const context = 'getEntriesByRateCardId';
  try {
    const { id } = req.params;
    logger.info('Fetching rate entries for rate card', { context, rateCardId: id });
    const entries = await rateCardService.findEntriesByRateCardId(id);
    logger.info(`Successfully fetched ${entries.length} rate entries`, { context, rateCardId: id });
    res.json(entries);
  } catch (error) {
    logger.error('Error fetching rate entries', { context, error: error.message, rateCardId: req.params.id });
    next(error);
  }
};

exports.getCustomersByRateCardId = async (req, res, next) => {
  const context = 'getCustomersByRateCardId';
  try {
    const { id } = req.params;
    logger.info('Fetching customers for rate card', { context, rateCardId: id });
    const customers = await rateCardService.findCustomersByRateCardId(id);
    logger.info(`Successfully fetched ${customers.length} customers`, { context, rateCardId: id });
    res.json(customers);
  } catch (error) {
    logger.error('Error fetching customers for rate card', { context, error: error.message, rateCardId: req.params.id });
    next(error);
  }
};

exports.assignCustomer = async (req, res, next) => {
  const context = 'assignCustomer';
  try {
    const { id: rateCardId, customerId } = req.params;
    logger.info('Assigning customer to rate card', { context, rateCardId, customerId });
    const assignment = await rateCardService.assignCustomerToRateCard(rateCardId, customerId);
    logger.info('Successfully assigned customer to rate card', { context, rateCardId, customerId });
    res.status(201).json(assignment);
  } catch (error) {
    logger.error('Error assigning customer to rate card', { 
      context,
      error: error.message, 
      rateCardId: req.params.id, 
      customerId: req.params.customerId 
    });
    next(error);
  }
};

exports.assignCustomersBulk = async (req, res, next) => {
  const context = 'assignCustomersBulk';
  try {
    const { id: rateCardId } = req.params;
    const { customerIds } = req.body;
    logger.info('Bulk assigning customers to rate card', { context, rateCardId, customerIds });

    const result = await rateCardService.assignCustomersToRateCardBulk(rateCardId, customerIds);

    logger.info('Successfully bulk assigned customers', { context, rateCardId, count: result.count });
    res.status(201).json(result);
  } catch (error) {
    logger.error('Error bulk assigning customers', { context, error: error.message, body: req.body });
    next(error);
  }
};

exports.unassignCustomer = async (req, res, next) => {
  const context = 'unassignCustomer';
  try {
    const { id: rateCardId, customerId } = req.params;
    logger.info('Unassigning customer from rate card', { context, rateCardId, customerId });
    await rateCardService.unassignCustomerFromRateCard(rateCardId, customerId);
    logger.info('Successfully unassigned customer from rate card', { context, rateCardId, customerId });
    res.status(204).send();
  } catch (error) {
    logger.error('Error unassigning customer from rate card', { 
      context,
      error: error.message, 
      rateCardId: req.params.id, 
      customerId: req.params.customerId 
    });
    next(error);
  }
};

exports.importRateEntries = async (req, res, next) => {
  const context = 'importRateEntries';
  try {
    const { id: rateCardId } = req.params;
    const parsedRateCardId = parseInt(rateCardId, 10);
    const { entries } = req.body;
    
    logger.info('=== BACKEND IMPORT START ===', { context, rateCardId, entryCount: entries ? entries.length : 0 });
    
    if (isNaN(parsedRateCardId)) {
      return res.status(400).json({ error: 'Invalid Rate Card ID.' });
    }

    if (!entries || !Array.isArray(entries)) {
      logger.error('Invalid data format for import', { context, rateCardId, hasEntries: !!entries, isArray: Array.isArray(entries) });
      return res.status(400).json({ error: 'Invalid data format. "entries" array is required.' });
    }

    // Detailed logging for import process
    // Używamy util.inspect, aby zobaczyć pełną zawartość obiektu
    logger.debug('First entry sample:', { context, sample: util.inspect(entries[0], { depth: null, colors: true }) });

    logger.info('Starting rate entries import', { 
      context,
      rateCardId, 
      entryCount: entries.length,
      sampleEntry: entries[0] 
    });

    const result = await rateCardService.importRateEntries(parsedRateCardId, entries);
    
    logger.debug('Import result from service:', { context, result: util.inspect(result, { depth: null, colors: true }) });
    logger.info('Import completed', {
      context,
      rateCardId,
      processed: result.count,
      skipped: result.skipped,
      totalErrors: result.errors ? result.errors.length : 0
    });

    res.status(201).json({ 
      message: `Successfully processed ${result.count} rate entries.`, 
      ...result 
    });
    logger.info('=== BACKEND IMPORT END ===', { context, rateCardId });
    
  } catch (error) {
    logger.error('Critical error during import', { 
      context,
      error: error.message,
      stack: error.stack,
      rateCardId: req.params.id,
      entryCount: req.body.entries ? req.body.entries.length : 'unknown'
    });
    next(error);
  }
};

// Debug endpoint to check zone mapping
exports.debugZones = async (req, res, next) => {
  const context = 'debugZones';
  try {
    logger.info('Debugging zone mapping', { context });
    const zones = await rateCardService.debugZoneMapping();
    res.json({ zones });
  } catch (error) {
    logger.error('Error debugging zones', { context, error: error.message });
    next(error);
  }
};

// Check zone mapping for specific CSV data
exports.checkZoneMapping = async (req, res, next) => {
  const context = 'checkZoneMapping';
  try {
    const { zoneNames } = req.body; // Array of zone names from CSV
    logger.info('Checking zone mapping for CSV data', { context, zoneNames });
    
    const zones = await rateCardService.getZoneMappingInfo();
    const zoneMap = new Map(zones.map(z => [z.zoneName.toString(), z.id]));
    
    const mappingResult = zoneNames.map(zoneName => ({
      csvZoneName: zoneName,
      foundInDb: zoneMap.has(zoneName.toString()),
      zoneId: zoneMap.get(zoneName.toString()) || null,
      dbZoneName: zones.find(z => z.zoneName.toString() === zoneName.toString())?.zoneName
    }));

    const missingZones = mappingResult.filter(r => !r.foundInDb);
    
    logger.info('Zone mapping check completed', {
      totalZonesChecked: zoneNames.length,
      missingZones: missingZones.length,
      availableZonesInDb: zones.map(z => z.zoneName)
    });

    res.json({
      mapping: mappingResult,
      summary: {
        total: zoneNames.length,
        found: zoneNames.length - missingZones.length,
        missing: missingZones.length,
        missingZones: missingZones.map(m => m.csvZoneName)
      },
      availableZones: zones.map(z => ({ id: z.id, name: z.zoneName }))
    });
  } catch (error) {
    logger.error('Error checking zone mapping', { context, error: error.message });
    next(error);
  }
};
//new commit