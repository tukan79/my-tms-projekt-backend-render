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
    const newItem = await surchargeTypeService.create(req.body);
    res.status(201).json(newItem);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const updatedItem = await surchargeTypeService.update(req.params.id, req.body);
    if (!updatedItem) return res.status(404).json({ error: 'Surcharge type not found.' });
    res.json(updatedItem);
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const changes = await surchargeTypeService.deleteById(req.params.id);
    if (changes === 0) return res.status(404).json({ error: 'Surcharge type not found.' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};