// Plik server/services/runService.js
const { Run, Driver, Truck, Trailer, sequelize } = require('../models');
const { Op } = require('sequelize');

const createRun = async (runData) => {
  // Mapujemy snake_case na camelCase dla modelu Sequelize
  const { run_date: runDate, type, truck_id: truckId, trailer_id: trailerId, driver_id: driverId } = runData;

  const newRun = await Run.create({
    runDate,
    type,
    truckId,
    trailerId: trailerId || null, // Zapewniamy, że pusty string staje się null
    driverId,
  });

  return newRun;
};

const findAllRuns = async (filters = {}) => {
  const whereClause = {};

  if (filters.date) {
    whereClause.runDate = filters.date;
  }

  // Używamy `include`, aby za jednym zapytaniem pobrać powiązane dane
  const runs = await Run.findAll({
    where: whereClause,
    include: [
      {
        model: Driver,
        as: 'driver',
        attributes: ['id', 'firstName', 'lastName'],
      },
      {
        model: Truck,
        as: 'truck',
        attributes: ['id', 'registrationPlate'],
      },
      {
        model: Trailer,
        as: 'trailer',
        attributes: ['id', 'registrationPlate'],
      },
    ],
    order: [
      ['runDate', 'DESC'],
      ['createdAt', 'DESC'],
    ],
  });

  return runs;
};

const deleteRun = async (id) => {
  // Używamy "soft delete" dla spójności i bezpieczeństwa danych.
  console.log(`[runService] Próba usunięcia (soft delete) przejazdu o ID: ${id}`);

  // Metoda `destroy` z opcją `paranoid: true` w modelu automatycznie wykona soft delete.
  const deletedRowsCount = await Run.destroy({
    where: { id: id },
  });

  console.log(`[runService] Liczba zmienionych wierszy w tabeli 'runs': ${deletedRowsCount}`);
  return deletedRowsCount;
};

const updateRunStatus = async (runId, status) => {
  const allowedStatuses = ['planned', 'in_progress', 'completed'];
  if (!allowedStatuses.includes(status)) {
    throw new Error(`Invalid status: "${status}". Allowed statuses are: ${allowedStatuses.join(', ')}.`);
  }

  const [updatedRowsCount, updatedRuns] = await Run.update(
    { status: status },
    {
      where: { id: runId },
      returning: true, // Zwraca zaktualizowane rekordy
    }
  );

  return updatedRowsCount > 0 ? updatedRuns[0] : null;
};

const updateRun = async (runId, runData) => {
  // Mapujemy snake_case na camelCase
  const { run_date: runDate, type, truck_id: truckId, trailer_id: trailerId, driver_id: driverId } = runData;

  const dataToUpdate = {
    runDate,
    type,
    truckId,
    trailerId: trailerId || null,
    driverId,
  };

  const [updatedRowsCount, updatedRuns] = await Run.update(
    dataToUpdate,
    {
      where: { id: runId },
      returning: true,
    }
  );

  return updatedRowsCount > 0 ? updatedRuns[0] : null;
};

module.exports = {
  createRun,
  findAllRuns,
  deleteRun,
  updateRunStatus,
  updateRun,
};