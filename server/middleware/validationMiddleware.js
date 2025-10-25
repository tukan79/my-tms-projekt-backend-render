// Plik: server/middleware/validationMiddleware.js
const validator = require('validator');

exports.validateRun = (req, res, next) => {
  const { run_date, type, driver_id, truck_id } = req.body;
  const errors = [];

  if (!run_date || !validator.isISO8601(run_date)) {
    errors.push('A valid run date is required.');
  }

  if (!type || !['collection', 'delivery', 'trunking'].includes(type)) {
    errors.push('A valid run type is required (collection, delivery, or trunking).');
  }

  if (!driver_id || !validator.isInt(String(driver_id), { min: 1 })) {
    errors.push('A valid driver ID is required.');
  }

  if (!truck_id || !validator.isInt(String(truck_id), { min: 1 })) {
    errors.push('A valid truck ID is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' ') });
  }
  next();
};