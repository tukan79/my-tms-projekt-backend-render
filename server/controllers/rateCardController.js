// Plik server/controllers/rateCardController.js
const rateCardService = require('../services/rateCardService.js');
const Papa = require('papaparse');

// --- Rate Card Controllers ---

exports.getAllRateCards = async (req, res, next) => {
  try {
    const rateCards = await rateCardService.findAllRateCards();
    res.json(rateCards);
  } catch (error) {
    next(error);
  }
};

exports.createRateCard = async (req, res, next) => {
  try {
    const newRateCard = await rateCardService.createRateCard(req.body);
    res.status(201).json(newRateCard);
  } catch (error) {
    next(error);
  }
};

exports.deleteRateCard = async (req, res, next) => {
  try {
    const changes = await rateCardService.deleteRateCard(req.params.rateCardId);
    if (changes === 0) return res.status(404).json({ error: 'Rate card not found.' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

exports.getCustomersForRateCard = async (req, res, next) => {
  try {
    const customers = await rateCardService.findCustomersForRateCard(req.params.rateCardId);
    res.json(customers);
  } catch (error) {
    next(error);
  }
};

exports.assignCustomer = async (req, res, next) => {
  try {
    const { rateCardId, customerId } = req.params;
    await rateCardService.assignCustomerToRateCard(rateCardId, customerId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

exports.unassignCustomer = async (req, res, next) => {
  try {
    const { rateCardId, customerId } = req.params;
    await rateCardService.unassignCustomerFromRateCard(rateCardId, customerId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

exports.exportRateEntries = async (req, res, next) => {
  try {
    const { rateCardId } = req.params;
    const entries = await rateCardService.findRateEntriesByCard(rateCardId);
    const dataToExport = await rateCardService.enrichRateEntriesWithZoneNames(entries);

    // Mapowanie kluczy na bardziej przyjazne nagłówki
    const fields = [
      { label: 'Rate Type', value: 'rate_type' },
      { label: 'Zone Name', value: 'zone_name' },
      { label: 'Service Level', value: 'service_level' },
      { label: 'Price Micro', value: 'price_micro' },
      { label: 'Price Quarter', value: 'price_quarter' },
      { label: 'Price Half', value: 'price_half' },
      { label: 'Price Half Plus', value: 'price_half_plus' },
      { label: 'Price Full 1', value: 'price_full_1' },
      { label: 'Price Full 2', value: 'price_full_2' },
      { label: 'Price Full 3', value: 'price_full_3' },
      { label: 'Price Full 4', value: 'price_full_4' },
      { label: 'Price Full 5', value: 'price_full_5' },
      { label: 'Price Full 6', value: 'price_full_6' },
      { label: 'Price Full 7', value: 'price_full_7' },
      { label: 'Price Full 8', value: 'price_full_8' },
      { label: 'Price Full 9', value: 'price_full_9' },
      { label: 'Price Full 10', value: 'price_full_10' },
    ];

    // Przygotowujemy dane jako tablicę tablic dla niezawodnego eksportu
    const header = fields.map(f => f.label);
    const dataRows = dataToExport.map(row => fields.map(f => row[f.value] ?? ''));

    const csv = Papa.unparse([header, ...dataRows], { header: false }); // Explicitly disable automatic header generation

    res.header('Content-Type', 'text/csv');
    res.attachment(`rate-card-${rateCardId}-export.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

exports.importRateEntries = async (req, res, next) => {
  try {
    const { rateCardId } = req.params;
    const { entries } = req.body;
    const result = await rateCardService.importRateEntries(rateCardId, entries);
    res.status(201).json({ message: `Successfully processed ${result.processedCount} entries.`, ...result });
  } catch (error) {
    next(error);
  }
};

// --- Rate Entry Controllers ---

exports.getEntriesForCard = async (req, res, next) => {
  try {
    const entries = await rateCardService.findRateEntriesByCard(req.params.rateCardId);
    res.json(entries);
  } catch (error) {
    next(error);
  }
};

exports.createEntryForCard = async (req, res, next) => {
  try {
    const newEntry = await rateCardService.createRateEntry(req.params.rateCardId, req.body);
    res.status(201).json(newEntry);
  } catch (error) {
    next(error);
  }
};

exports.updateEntry = async (req, res, next) => {
  try {
    const updatedEntry = await rateCardService.updateRateEntry(req.params.entryId, req.body);
    if (!updatedEntry) return res.status(404).json({ error: 'Rate entry not found.' });
    res.json(updatedEntry);
  } catch (error) {
    next(error);
  }
};

exports.deleteEntry = async (req, res, next) => {
  try {
    const changes = await rateCardService.deleteRateEntry(req.params.entryId);
    if (changes === 0) return res.status(404).json({ error: 'Rate entry not found.' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};