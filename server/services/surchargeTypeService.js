// Plik: server/services/surchargeTypeService.js
const { SurchargeType } = require('../models');

const findAll = async () => {
  return SurchargeType.findAll({
    order: [['name', 'ASC']],
  });
};

const create = async (surchargeData) => {
  const { code, name, description, calculation_method: calculationMethod, amount, is_automatic: isAutomatic, requires_time: requiresTime, start_time: startTime, end_time: endTime } = surchargeData;
  return SurchargeType.create({
    code,
    name,
    description,
    calculationMethod,
    amount,
    isAutomatic: isAutomatic || false,
    requiresTime: requiresTime || false,
    startTime: startTime || null,
    endTime: endTime || null,
  });
};

const update = async (id, surchargeData) => {
  const { code, name, description, calculation_method: calculationMethod, amount, is_automatic: isAutomatic, requires_time: requiresTime, start_time: startTime, end_time: endTime } = surchargeData;
  
  const [updatedRowsCount, updatedSurcharges] = await SurchargeType.update(
    {
      code, name, description, calculationMethod, amount, isAutomatic, requiresTime, startTime, endTime
    },
    {
      where: { id },
      returning: true,
    }
  );

  return updatedRowsCount > 0 ? updatedSurcharges[0] : null;
};

const deleteById = async (id) => {
  // Model SurchargeType nie ma `paranoid: true`, więc to będzie twarde usunięcie.
  // Jeśli zlecenie używa tego typu dopłaty, baza danych (ON DELETE RESTRICT) zwróci błąd.
  return SurchargeType.destroy({
    where: { id },
  });
};

module.exports = {
  findAll,
  create,
  update,
  deleteById,
};