const { solveOrToolsPlan } = require('../services/optimizationService.js');

exports.solveOrTools = async (req, res, next) => {
  try {
    const result = await solveOrToolsPlan(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};
