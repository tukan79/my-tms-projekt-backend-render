// Plik: server/controllers/rateCardController.js
const rateCardService = require('../services/rateCardService');
const util = require('util'); // Importujemy moduł 'util'

// Helper function for consistent logging
const log = (level, context, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    context: `RateCardController.${context}`,
    message
  };
  
  if (data) {
    logEntry.data = data;
  }
  
  console.log(JSON.stringify(logEntry, null, 2));
};

const getAllRateCards = async (req, res, next) => {
  const context = 'getAllRateCards';
  try {
    log('INFO', context, 'Fetching all rate cards');
    const rateCards = await rateCardService.findAllRateCards();
    log('INFO', context, `Successfully fetched ${rateCards.length} rate cards`);
    res.json(rateCards);
  } catch (error) {
    log('ERROR', context, 'Error fetching rate cards', { error: error.message });
    next(error);
  }
};

const createRateCard = async (req, res, next) => {
  const context = 'createRateCard';
  try {
    log('INFO', context, 'Creating new rate card', { body: req.body });
    const newRateCard = await rateCardService.createRateCard(req.body);
    log('INFO', context, 'Successfully created rate card', { id: newRateCard.id, name: newRateCard.name });
    res.status(201).json(newRateCard);
  } catch (error) {
    log('ERROR', context, 'Error creating rate card', { error: error.message, body: req.body });
    next(error);
  }
};

const updateRateCard = async (req, res, next) => {
  const context = 'updateRateCard';
  try {
    const { id } = req.params;
    log('INFO', context, 'Updating rate card', { id, updates: req.body });
    const updatedRateCard = await rateCardService.updateRateCard(id, req.body);
    if (!updatedRateCard) {
      log('WARN', context, 'Rate card not found', { id });
      return res.status(404).json({ error: 'Rate card not found' });
    }
    log('INFO', context, 'Successfully updated rate card', { id: updatedRateCard.id });
    res.json(updatedRateCard);
  } catch (error) {
    log('ERROR', context, 'Error updating rate card', { error: error.message, id: req.params.id, body: req.body });
    next(error);
  }
};

const getEntriesByRateCardId = async (req, res, next) => {
  const context = 'getEntriesByRateCardId';
  try {
    const { id } = req.params;
    log('INFO', context, 'Fetching rate entries for rate card', { rateCardId: id });
    const entries = await rateCardService.findEntriesByRateCardId(id);
    log('INFO', context, `Successfully fetched ${entries.length} rate entries`, { rateCardId: id });
    res.json(entries);
  } catch (error) {
    log('ERROR', context, 'Error fetching rate entries', { error: error.message, rateCardId: req.params.id });
    next(error);
  }
};

const getCustomersByRateCardId = async (req, res, next) => {
  const context = 'getCustomersByRateCardId';
  try {
    const { id } = req.params;
    log('INFO', context, 'Fetching customers for rate card', { rateCardId: id });
    const customers = await rateCardService.findCustomersByRateCardId(id);
    log('INFO', context, `Successfully fetched ${customers.length} customers`, { rateCardId: id });
    res.json(customers);
  } catch (error) {
    log('ERROR', context, 'Error fetching customers for rate card', { error: error.message, rateCardId: req.params.id });
    next(error);
  }
};

const assignCustomer = async (req, res, next) => {
  const context = 'assignCustomer';
  try {
    const { id: rateCardId, customerId } = req.params;
    log('INFO', context, 'Assigning customer to rate card', { rateCardId, customerId });
    const assignment = await rateCardService.assignCustomerToRateCard(rateCardId, customerId);
    log('INFO', context, 'Successfully assigned customer to rate card', { rateCardId, customerId });
    res.status(201).json(assignment);
  } catch (error) {
    log('ERROR', context, 'Error assigning customer to rate card', { 
      error: error.message, 
      rateCardId: req.params.id, 
      customerId: req.params.customerId 
    });
    next(error);
  }
};

const assignCustomersBulk = async (req, res, next) => {
  const context = 'assignCustomersBulk';
  try {
    const { id: rateCardId } = req.params;
    const { customerIds } = req.body;
    log('INFO', context, 'Bulk assigning customers to rate card', { rateCardId, customerIds });

    const result = await rateCardService.assignCustomersToRateCardBulk(rateCardId, customerIds);

    log('INFO', context, 'Successfully bulk assigned customers', { rateCardId, count: result.count });
    res.status(201).json(result);
  } catch (error) {
    log('ERROR', context, 'Error bulk assigning customers', { error: error.message, body: req.body });
    next(error);
  }
};

const unassignCustomer = async (req, res, next) => {
  const context = 'unassignCustomer';
  try {
    const { id: rateCardId, customerId } = req.params;
    log('INFO', context, 'Unassigning customer from rate card', { rateCardId, customerId });
    await rateCardService.unassignCustomerFromRateCard(rateCardId, customerId);
    log('INFO', context, 'Successfully unassigned customer from rate card', { rateCardId, customerId });
    res.status(204).send();
  } catch (error) {
    log('ERROR', context, 'Error unassigning customer from rate card', { 
      error: error.message, 
      rateCardId: req.params.id, 
      customerId: req.params.customerId 
    });
    next(error);
  }
};

const importRateEntries = async (req, res, next) => {
  const context = 'importRateEntries';
  try {
    const { id: rateCardId } = req.params;
    const { entries } = req.body;
    
    log('INFO', context, '=== BACKEND IMPORT START ===', { rateCardId, entryCount: entries ? entries.length : 0 });
    
    if (!entries || !Array.isArray(entries)) {
      log('ERROR', context, 'Invalid data format', { rateCardId, hasEntries: !!entries, isArray: Array.isArray(entries) });
      return res.status(400).json({ error: 'Invalid data format. "entries" array is required.' });
    }

    // Detailed logging for import process
    // Używamy util.inspect, aby zobaczyć pełną zawartość obiektu
    console.log('First entry sample:', util.inspect(entries[0], { depth: null, colors: true }));

    log('INFO', context, 'Starting rate entries import', { 
      rateCardId, 
      entryCount: entries.length,
      sampleEntry: entries[0] 
    });

    const result = await rateCardService.importRateEntries(rateCardId, entries);
    
    console.log('Import result from service:', util.inspect(result, { depth: null, colors: true }));
    log('INFO', context, 'Import completed', {
      rateCardId,
      processed: result.count,
      skipped: result.skipped,
      totalErrors: result.errors ? result.errors.length : 0
    });

    res.status(201).json({ 
      message: `Successfully processed ${result.count} rate entries.`, 
      ...result 
    });
    log('INFO', context, '=== BACKEND IMPORT END ===', { rateCardId });
    
  } catch (error) {
    log('ERROR', context, 'Critical error during import', { 
      error: error.message,
      stack: error.stack,
      rateCardId: req.params.id,
      entryCount: req.body.entries ? req.body.entries.length : 'unknown'
    });
    next(error);
  }
};

// Debug endpoint to check zone mapping
const debugZones = async (req, res, next) => {
  const context = 'debugZones';
  try {
    log('INFO', context, 'Debugging zone mapping');
    const zones = await rateCardService.debugZoneMapping();
    res.json({ zones });
  } catch (error) {
    log('ERROR', context, 'Error debugging zones', { error: error.message });
    next(error);
  }
};

// Check zone mapping for specific CSV data
const checkZoneMapping = async (req, res, next) => {
  const context = 'checkZoneMapping';
  try {
    const { zoneNames } = req.body; // Array of zone names from CSV
    log('INFO', context, 'Checking zone mapping for CSV data', { zoneNames });
    
    const zones = await rateCardService.getZoneMappingInfo();
    const zoneMap = new Map(zones.map(z => [z.zone_name.toString(), z.id]));
    
    const mappingResult = zoneNames.map(zoneName => ({
      csvZoneName: zoneName,
      foundInDb: zoneMap.has(zoneName.toString()),
      zoneId: zoneMap.get(zoneName.toString()) || null,
      dbZoneName: zones.find(z => z.zone_name.toString() === zoneName.toString())?.zone_name
    }));

    const missingZones = mappingResult.filter(r => !r.foundInDb);
    
    log('INFO', context, 'Zone mapping check completed', {
      totalZonesChecked: zoneNames.length,
      missingZones: missingZones.length,
      availableZonesInDb: zones.map(z => z.zone_name)
    });

    res.json({
      mapping: mappingResult,
      summary: {
        total: zoneNames.length,
        found: zoneNames.length - missingZones.length,
        missing: missingZones.length,
        missingZones: missingZones.map(m => m.csvZoneName)
      },
      availableZones: zones.map(z => ({ id: z.id, name: z.zone_name }))
    });
  } catch (error) {
    log('ERROR', context, 'Error checking zone mapping', { error: error.message });
    next(error);
  }
};

module.exports = {
  getAllRateCards,
  createRateCard,
  updateRateCard,
  getEntriesByRateCardId,
  getCustomersByRateCardId,
  assignCustomer,
  unassignCustomer,
  assignCustomersBulk,
  importRateEntries,
  debugZones,
  checkZoneMapping
};