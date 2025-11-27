// server/services/runService.js

const { Run, Driver, Truck, Trailer, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Standardized logging
 */
const log = (level, ctx, message, data = null) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    context: `runService.${ctx}`,
    message,
  };
  if (data) entry.data = data;
  console.log(JSON.stringify(entry));
};

/**
 * Creates a new run.
 * @param {Object} runData
 * @returns {Promise<Object>} created Run
 */
const createRun = async (runData) => {
  const ctx = 'createRun';
  try {
    const { run_date: runDate, type, truck_id: truckId, trailer_id: trailerId, driver_id: driverId } = runData;

    log('INFO', ctx, 'Creating new run', runData);

    const newRun = await Run.create({
      runDate,
      type,
      truckId,
      trailerId: trailerId || null,
      driverId,
    });

    return newRun;
  } catch (error) {
    log('ERROR', ctx, 'Error creating run', { error: error.message });
    throw error;
  }
};

/**
 * Retrieves all runs with optional filters.
 * @param {Object} filters
 * @returns {Promise<Array>} list of runs
 */
const findAllRuns = async (filters = {}) => {
  const ctx = 'findAllRuns';
  try {
    const whereClause = {};
    if (filters.date) {
      whereClause.runDate = filters.date;
    }

    log('INFO', ctx, 'Fetching runs', { filters });

    const runs = await Run.findAll({
      where: whereClause,
      include: [
        { model: Driver, as: 'driver', attributes: ['id', 'firstName', 'lastName'] },
        { model: Truck, as: 'truck', attributes: ['id', 'registrationPlate'] },
        { model: Trailer, as: 'trailer', attributes: ['id', 'registrationPlate'] },
      ],
      order: [
        ['runDate', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });

    return runs.map(run => {
      const plainRun = run.get({ plain: true });
      plainRun.driver_id = plainRun.driver?.id || null;
      plainRun.truck_id = plainRun.truck?.id || null;
      plainRun.trailer_id = plainRun.trailer?.id || null;
      return plainRun;
    });
  } catch (error) {
    log('ERROR', ctx, 'Error fetching runs', { error: error.message });
    throw error;
  }
};

/**
 * Soft deletes a run by ID.
 * @param {number} id
 * @returns {Promise<number>} deleted row count
 */
const deleteRun = async (id) => {
  const ctx = 'deleteRun';
  try {
    log('INFO', ctx, 'Deleting run', { runId: id });

    const deletedCount = await Run.destroy({ where: { id } });

    log('INFO', ctx, 'Delete operation completed', { runId: id, deletedCount });

    return deletedCount;
  } catch (error) {
    log('ERROR', ctx, 'Error deleting run', { runId: id, error: error.message });
    throw error;
  }
};

/**
 * Updates run status.
 * @param {number} runId
 * @param {string} status
 * @returns {Promise<Object|null>} updated run or null
 */
const updateRunStatus = async (runId, status) => {
  const ctx = 'updateRunStatus';
  try {
    const allowedStatuses = ['planned', 'in_progress', 'completed'];
    if (!allowedStatuses.includes(status)) {
      throw new Error(`Invalid status: "${status}". Allowed: ${allowedStatuses.join(', ')}`);
    }

    log('INFO', ctx, 'Updating run status', { runId, status });

    const [updatedCount, updatedRuns] = await Run.update(
      { status },
      { where: { id: runId }, returning: true }
    );

    return updatedCount > 0 ? updatedRuns[0] : null;
  } catch (error) {
    log('ERROR', ctx, 'Error updating run status', { runId, status, error: error.message });
    throw error;
  }
};

/**
 * Updates run metadata.
 * @param {number} runId
 * @param {Object} runData
 * @returns {Promise<Object|null>} updated run or null
 */
const updateRun = async (runId, runData) => {
  const ctx = 'updateRun';
  try {
    const { run_date: runDate, type, truck_id: truckId, trailer_id: trailerId, driver_id: driverId } = runData;

    log('INFO', ctx, 'Updating run', { runId, runData });

    const [updatedCount, updatedRuns] = await Run.update(
      { runDate, type, truckId, trailerId: trailerId || null, driverId },
      { where: { id: runId }, returning: true }
    );

    return updatedCount > 0 ? updatedRuns[0] : null;
  } catch (error) {
    log('ERROR', ctx, 'Error updating run', { runId, runData, error: error.message });
    throw error;
  }
};

module.exports = {
  createRun,
  findAllRuns,
  deleteRun,
  updateRunStatus,
  updateRun,
};
