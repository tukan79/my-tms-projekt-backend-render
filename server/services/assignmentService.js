// Plik server/services/assignmentService.js
const db = require('../db/index.js');

const createAssignment = async ({ order_id, run_id, notes }) => {
  // Używamy transakcji, aby zapewnić, że obie operacje (wstawienie i aktualizacja) powiodą się lub żadna.
  return db.withTransaction(async (client) => {
    // Krok 1: Wstaw nowe przypisanie
    const assignmentSql = `
      INSERT INTO assignments (order_id, run_id, notes)
      VALUES ($1, $2, $3) RETURNING *
    `;
    const assignmentResult = await client.query(assignmentSql, [order_id, run_id, notes]);
    const newAssignment = assignmentResult.rows[0];

    // Krok 2: Zaktualizuj status zlecenia na "zaplanowane"
    const updateOrderSql = `
      UPDATE orders SET status = 'zaplanowane' WHERE id = $1
    `;
    await client.query(updateOrderSql, [order_id]);

    // Krok 3: Zwróć nowo utworzone przypisanie
    return newAssignment;
  });
};

const findAllAssignments = async () => {
  const { rows } = await db.query('SELECT * FROM assignments WHERE is_deleted = FALSE ORDER BY created_at DESC');
  return rows;
};

const deleteAssignment = async (assignmentId) => {
  // Używamy transakcji, aby zapewnić spójność danych
  return db.withTransaction(async (client) => {
    // Krok 1: Znajdź przypisanie, aby uzyskać order_id
    const findSql = 'SELECT order_id FROM assignments WHERE id = $1';
    const findResult = await client.query(findSql, [assignmentId]);
    
    if (findResult.rows.length === 0) {
      return 0; // Przypisanie nie istnieje
    }
    const { order_id } = findResult.rows[0];

    // Krok 2: Usuń przypisanie
    const deleteSql = 'DELETE FROM assignments WHERE id = $1';
    const deleteResult = await client.query(deleteSql, [assignmentId]);

    // Krok 3: Zaktualizuj status zlecenia z powrotem na "nowe"
    const updateOrderSql = `UPDATE orders SET status = 'nowe' WHERE id = $1`;
    await client.query(updateOrderSql, [order_id]);

    return deleteResult.rowCount;
  });
};

module.exports = {
  createAssignment,
  findAllAssignments,
  deleteAssignment,
};