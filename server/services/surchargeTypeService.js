// Plik: server/services/surchargeTypeService.js
const db = require('../db/index.js');

const findAll = async () => {
  const { rows } = await db.query('SELECT * FROM surcharge_types ORDER BY name');
  return rows;
};

const create = async (surchargeData) => {
  const { code, name, description, calculation_method, amount, is_automatic, requires_time, start_time, end_time } = surchargeData;
  const sql = `
    INSERT INTO surcharge_types (code, name, description, calculation_method, amount, is_automatic, requires_time, start_time, end_time)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
  `;
  const { rows } = await db.query(sql, [code, name, description, calculation_method, amount, is_automatic || false, requires_time || false, start_time || null, end_time || null]);
  return rows[0];
};

const update = async (id, surchargeData) => {
  const { code, name, description, calculation_method, amount, is_automatic, requires_time, start_time, end_time } = surchargeData;
  const sql = `
    UPDATE surcharge_types
    SET code = $1, name = $2, description = $3, calculation_method = $4, amount = $5, is_automatic = $6, requires_time = $7, start_time = $8, end_time = $9, updated_at = NOW()
    WHERE id = $10 RETURNING *;
  `;
  const { rows } = await db.query(sql, [code, name, description, calculation_method, amount, is_automatic || false, requires_time || false, start_time || null, end_time || null, id]);
  return rows[0] || null;
};

const deleteById = async (id) => {
  const result = await db.query('DELETE FROM surcharge_types WHERE id = $1', [id]);
  return result.rowCount;
};

module.exports = {
  findAll,
  create,
  update,
  deleteById,
};