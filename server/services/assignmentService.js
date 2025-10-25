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

const bulkCreateAssignments = async (run_id, order_ids) => {
  // Używamy transakcji, aby zapewnić, że wszystkie przypisania zostaną utworzone, albo żadne.
  return db.withTransaction(async (client) => {
    // Krok 1: Usuń istniejące przypisania dla tych zleceń, aby uniknąć konfliktów.
    const deleteSql = 'DELETE FROM assignments WHERE order_id = ANY($1::int[])';
    await client.query(deleteSql, [order_ids]);

    // Krok 2: Wstaw nowe przypisania.
    let createdCount = 0;
    const insertSql = `
      INSERT INTO assignments (run_id, order_id) VALUES ($1, $2)
    `; // Usunięto ON CONFLICT, ponieważ stare przypisania są już usunięte.

    for (const order_id of order_ids) {
      const result = await client.query(insertSql, [run_id, order_id]);
      createdCount += result.rowCount;
    }

    // Krok 3: Zaktualizuj status wszystkich przypisanych zleceń na 'zaplanowane'
    if (order_ids.length > 0) {
      const updateOrderStatusSql = `
        UPDATE orders SET status = 'zaplanowane' WHERE id = ANY($1::int[])
      `;
      await client.query(updateOrderStatusSql, [order_ids]);
    }

    return { createdCount };
  });
};

module.exports = {
  createAssignment,
  findAllAssignments,
  deleteAssignment,
  bulkCreateAssignments,
};