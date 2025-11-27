// server/controllers/surchargeTypeController.js
const surchargeTypeService = require('../services/surchargeTypeService.js');

/**
 * Standardized logging
 */
const log = (level, ctx, message, data = null) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    context: `surchargeTypeController.${ctx}`,
    message,
  };
  if (data) entry.data = data;
  console.log(JSON.stringify(entry));
};

exports.getAll = async (req, res, next) => {
  const ctx = 'getAll';
  try {
    log('INFO', ctx, 'Fetching all surcharge types');
    const items = await surchargeTypeService.findAll();
    log('INFO', ctx, `Fetched ${items.length} surcharge types`);
    res.json({ surchargeTypes: items || [] });
  } catch (error) {
    log('ERROR', ctx, 'Error fetching surcharge types', { error: error.message });
    next(error);
  }
};

exports.create = async (req, res, next) => {
  const ctx = 'create';
  try {
    const payload = {
      code: req.body.code,
      name: req.body.name,
      description: req.body.description,
      calculation_method: req.body.calculation_method,
      amount: req.body.amount,
      is_automatic: req.body.is_automatic,
      requires_time: req.body.requires_time,
      start_time: req.body.start_time,
      end_time: req.body.end_time,
    };

    log('INFO', ctx, 'Creating new surcharge type', payload);

    const newItem = await surchargeTypeService.create(payload);

    log('INFO', ctx, 'Surcharge type created', { id: newItem.id });
    res.status(201).json(newItem);
  } catch (error) {
    log('ERROR', ctx, 'Error creating surcharge type', { error: error.message, body: req.body });
    next(error);
  }
};

exports.update = async (req, res, next) => {
  const ctx = 'update';
  try {
    const payload = {
      code: req.body.code,
      name: req.body.name,
      description: req.body.description,
      calculation_method: req.body.calculation_method,
      amount: req.body.amount,
      is_automatic: req.body.is_automatic,
      requires_time: req.body.requires_time,
      start_time: req.body.start_time,
      end_time: req.body.end_time,
    };

    log('INFO', ctx, 'Updating surcharge type', { id: req.params.id, updates: payload });

    const updatedItem = await surchargeTypeService.update(req.params.id, payload);

    if (!updatedItem) {
      log('WARN', ctx, 'Surcharge type not found', { id: req.params.id });
      return res.status(404).json({ error: 'Surcharge type not found.' });
    }

    log('INFO', ctx, 'Surcharge type updated', { id: updatedItem.id });
    res.json(updatedItem);
  } catch (error) {
    log('ERROR', ctx, 'Error updating surcharge type', { error: error.message, body: req.body });
    next(error);
  }
};

exports.deleteSurcharge = async (req, res, next) => {
  const ctx = 'deleteSurcharge';
  try {
    log('INFO', ctx, 'Deleting surcharge type', { id: req.params.id });
    const changes = await surchargeTypeService.deleteById(req.params.id);

    if (changes === 0) {
      log('WARN', ctx, 'Surcharge type not found', { id: req.params.id });
      return res.status(404).json({ error: 'Surcharge type not found.' });
    }

    log('INFO', ctx, 'Surcharge type deleted', { id: req.params.id });
    res.status(204).send();
  } catch (error) {
    log('ERROR', ctx, 'Error deleting surcharge type', { error: error.message });
    next(error);
  }
};
