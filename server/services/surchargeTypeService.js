// server/services/surchargeTypeService.js
const { SurchargeType } = require('../models');

/**
 * Standardized logging helper for service
 */
const logService = (level, context, message, data = null) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    context: `SurchargeTypeService.${context}`,
    message,
  };
  if (data) entry.data = data;
  console.log(JSON.stringify(entry, null, 2));
};

const findAll = async () => {
  const ctx = 'findAll';
  try {
    logService('INFO', ctx, 'Fetching all surcharge types');
    const items = await SurchargeType.findAll({
      order: [['name', 'ASC']],
    });
    logService('INFO', ctx, `Fetched ${items.length} surcharge types`);
    return items;
  } catch (error) {
    logService('ERROR', ctx, 'Error fetching surcharge types', { error: error.message });
    throw error;
  }
};

const create = async (surchargeData) => {
  const ctx = 'create';
  try {
    const {
      code,
      name,
      description,
      calculation_method: calculationMethod,
      amount,
      is_automatic: isAutomatic = false,
      requires_time: requiresTime = false,
      start_time: startTime,
      end_time: endTime,
    } = surchargeData;

    logService('INFO', ctx, 'Creating new surcharge type', { code, name });

    const newItem = await SurchargeType.create({
      code,
      name,
      description,
      calculationMethod,
      amount,
      isAutomatic,
      requiresTime,
      startTime,
      endTime,
    });

    logService('INFO', ctx, 'Surcharge type created', { id: newItem.id });
    return newItem;
  } catch (error) {
    logService('ERROR', ctx, 'Error creating surcharge type', { error: error.message, body: surchargeData });
    throw error;
  }
};

const update = async (id, surchargeData) => {
  const ctx = 'update';
  try {
    const {
      code,
      name,
      description,
      calculation_method: calculationMethod,
      amount,
      is_automatic: isAutomatic,
      requires_time: requiresTime,
      start_time: startTime,
      end_time: endTime,
    } = surchargeData;

    logService('INFO', ctx, 'Updating surcharge type', { id, updates: surchargeData });

    const [updatedRowsCount, updatedItems] = await SurchargeType.update(
      {
        code,
        name,
        description,
        calculationMethod,
        amount,
        isAutomatic,
        requiresTime,
        startTime,
        endTime,
      },
      {
        where: { id },
        returning: true,
      }
    );

    if (updatedRowsCount === 0) {
      logService('WARN', ctx, 'Surcharge type not found', { id });
      return null;
    }

    logService('INFO', ctx, 'Surcharge type updated', { id: updatedItems[0].id });
    return updatedItems[0];
  } catch (error) {
    logService('ERROR', ctx, 'Error updating surcharge type', { id, error: error.message });
    throw error;
  }
};

const deleteById = async (id) => {
  const ctx = 'deleteById';
  try {
    logService('INFO', ctx, 'Deleting surcharge type', { id });
    const deletedCount = await SurchargeType.destroy({ where: { id } });

    if (deletedCount === 0) {
      logService('WARN', ctx, 'Surcharge type not found', { id });
    } else {
      logService('INFO', ctx, 'Surcharge type deleted', { id });
    }

    return deletedCount;
  } catch (error) {
    logService('ERROR', ctx, 'Error deleting surcharge type', { id, error: error.message });
    throw error;
  }
};

module.exports = {
  findAll,
  create,
  update,
  deleteById,
};
