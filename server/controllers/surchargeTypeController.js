// Plik: server/controllers/surchargeTypeController.js
const surchargeTypeService = require('../services/surchargeTypeService.js');

exports.getAll = async (req, res, next) => {
  try {
    const items = await surchargeTypeService.findAll();
    res.json(items);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    // Mapujemy snake_case z req.body na camelCase dla serwisu
    const newItem = await surchargeTypeService.create({
      code: req.body.code,
      name: req.body.name,
      description: req.body.description,
      calculationMethod: req.body.calculation_method,
      amount: req.body.amount,
      isAutomatic: req.body.is_automatic,
      requiresTime: req.body.requires_time,
      startTime: req.body.start_time,
      endTime: req.body.end_time,
    });
    res.status(201).json(newItem);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    // Mapujemy snake_case z req.body na camelCase dla serwisu
    const updatedItem = await surchargeTypeService.update(req.params.id, {
      code: req.body.code,
      name: req.body.name,
      description: req.body.description,
      calculationMethod: req.body.calculation_method,
      amount: req.body.amount,
      isAutomatic: req.body.is_automatic,
      requiresTime: req.body.requires_time,
      startTime: req.body.start_time,
      endTime: req.body.end_time,
    });
    if (!updatedItem) return res.status(404).json({ error: 'Surcharge type not found.' });
    res.json(updatedItem);
  } catch (error) {
    next(error);
  }
};

exports.deleteSurcharge = async (req, res, next) => {
  try {
    const changes = await surchargeTypeService.deleteById(req.params.id);
    if (changes === 0) return res.status(404).json({ error: 'Surcharge type not found.' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};