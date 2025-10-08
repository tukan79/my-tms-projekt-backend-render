// Plik server/services/runService.js
const db = require('../db/index.js');

const createRun = async (runData) => {
  const { run_date, type, truck_id, trailer_id, driver_id } = runData;
  const sql = `
    INSERT INTO runs (run_date, type, truck_id, trailer_id, driver_id)
    VALUES ($1, $2, $3, $4, $5) RETURNING *
  `;
  const { rows } = await db.query(sql, [run_date, type, truck_id, trailer_id, driver_id]);
  return rows[0];
};

const findAllRuns = async () => {
  // Poprawka: Formatujemy datę bezpośrednio w zapytaniu SQL do stringa 'YYYY-MM-DD'.
  // To eliminuje wszystkie problemy ze strefami czasowymi po stronie klienta.
  const sql = `
    SELECT 
      id, 
      TO_CHAR(run_date, 'YYYY-MM-DD') as run_date, 
      type, truck_id, trailer_id, driver_id, status, created_at, updated_at 
    FROM runs WHERE is_deleted = FALSE ORDER BY run_date DESC
  `;
  const { rows } = await db.query(sql);
  return rows;
};

const deleteRun = async (runId) => {
  // Używamy "soft delete" dla spójności i bezpieczeństwa danych.
  // We use "soft delete" for data consistency and safety.
  console.log(`[runService] Próba usunięcia (soft delete) przejazdu o ID: ${runId}`);
  const sql = 'UPDATE runs SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1';
  const result = await db.query(sql, [runId]);
  // Zwracamy liczbę zmienionych wierszy. Powinno być 1, jeśli operacja się powiodła.
  // Return the number of affected rows. Should be 1 on success.
  console.log(`[runService] Liczba zmienionych wierszy w tabeli 'runs': ${result.rowCount}`);
  return result.rowCount;
};

// W przyszłości można dodać funkcje do aktualizacji przejazdów.
// In the future, functions for updating runs can be added.
// const updateRun = async (runId, runData) => { ... };

module.exports = {
  createRun,
  findAllRuns,
  deleteRun,
};