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
  // W przyszłości można dodać filtrowanie po dacie
  const { rows } = await db.query('SELECT * FROM runs WHERE is_deleted = FALSE ORDER BY run_date DESC, created_at DESC');
  return rows;
};

const deleteRun = async (runId) => {
  // Sprawdzamy, czy do przejazdu nie są przypisane żadne zlecenia
  const checkAssignments = await db.query('SELECT id FROM assignments WHERE run_id = $1', [runId]);
  if (checkAssignments.rows.length > 0) {
    throw new Error('Cannot delete a run that has active assignments. Please remove assignments first.');
  }

  const sql = 'UPDATE runs SET is_deleted = TRUE WHERE id = $1';
  const result = await db.query(sql, [runId]);
  return result.rowCount;
};

module.exports = {
  createRun,
  findAllRuns,
  deleteRun,
};