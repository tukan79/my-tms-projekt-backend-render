// Plik server/services/runService.js
const db = require('../db/index.js');

const createRun = async (runData) => {
  const { run_date, type, truck_id, trailer_id, driver_id } = runData;
  // Poprawka: Jeśli trailer_id jest pustym stringiem, zamień go na null.
  const sql = `
    INSERT INTO runs (run_date, type, truck_id, trailer_id, driver_id)
    VALUES ($1, $2, $3, $4, $5) RETURNING *
  `;
  const { rows } = await db.query(sql, [run_date, type, truck_id, trailer_id || null, driver_id]);
  return rows[0];
};

const findAllRuns = async (filters = {}) => {
  // Poprawka: Formatujemy datę bezpośrednio w zapytaniu SQL do stringa 'YYYY-MM-DD'.
  // To eliminuje wszystkie problemy ze strefami czasowymi po stronie klienta.
  let sql = `
    SELECT 
      id, 
      TO_CHAR(run_date, 'YYYY-MM-DD') as run_date, 
      type, truck_id, trailer_id, driver_id, status, created_at, updated_at 
    FROM runs WHERE is_deleted = FALSE
  `;
  const params = [];

  if (filters.date) {
    params.push(filters.date);
    sql += ` AND run_date = $${params.length}`;
  }

  // Domyślne sortowanie, jeśli żadne inne nie jest zdefiniowane
  sql += ' ORDER BY run_date DESC, created_at DESC';

  const { rows } = await db.query(sql, params);
  return rows;
};

const deleteRun = async (id) => {
  // Używamy "soft delete" dla spójności i bezpieczeństwa danych.
  // We use "soft delete" for data consistency and safety.
  console.log(`[runService] Próba usunięcia (soft delete) przejazdu o ID: ${id}`);
  const sql = 'UPDATE runs SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1';
  const result = await db.query(sql, [id]);
  // Zwracamy liczbę zmienionych wierszy. Powinno być 1, jeśli operacja się powiodła.
  // Return the number of affected rows. Should be 1 on success.
  console.log(`[runService] Liczba zmienionych wierszy w tabeli 'runs': ${result.rowCount}`);
  return result.rowCount;
};

const updateRunStatus = async (runId, status) => {
  const allowedStatuses = ['planned', 'in_progress', 'completed'];
  if (!allowedStatuses.includes(status)) {
    // Rzucamy błąd, jeśli status jest nieprawidłowy
    throw new Error(`Invalid status: "${status}". Allowed statuses are: ${allowedStatuses.join(', ')}.`);
  }

  const sql = `
    UPDATE runs
    SET status = $1, updated_at = NOW()
    WHERE id = $2 AND is_deleted = FALSE
    RETURNING *;
  `;
  const { rows } = await db.query(sql, [status, runId]);
  return rows[0] || null; // Zwraca zaktualizowany przejazd lub null, jeśli nie znaleziono
};

const updateRun = async (runId, runData) => {
  const { run_date, type, truck_id, trailer_id, driver_id } = runData;
  const sql = `
    UPDATE runs
    SET 
      run_date = $1, 
      type = $2, 
      truck_id = $3, 
      trailer_id = $4, 
      driver_id = $5, 
      updated_at = NOW()
    WHERE id = $6 AND is_deleted = FALSE
    RETURNING *;
  `;
  const { rows } = await db.query(sql, [run_date, type, truck_id, trailer_id || null, driver_id, runId]);
  return rows[0] || null;
};

module.exports = {
  createRun,
  findAllRuns,
  deleteRun,
  updateRunStatus,
  updateRun,
};