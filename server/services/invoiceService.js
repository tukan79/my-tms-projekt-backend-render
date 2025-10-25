// Plik: server/services/invoiceService.js
const db = require('../db/index.js');

/**
 * Generuje następny numer faktury w formacie ROK/MIESIĄC/NUMER.
 * @returns {Promise<string>} Nowy numer faktury.
 */
const getNextInvoiceNumber = async (client) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const prefix = `${year}/${String(month).padStart(2, '0')}/`;

  const { rows } = await client.query(
    "SELECT invoice_number FROM invoices WHERE invoice_number LIKE $1 ORDER BY invoice_number DESC LIMIT 1",
    [`${prefix}%`]
  );

  if (rows.length === 0) {
    return `${prefix}1`;
  }

  const lastNumber = parseInt(rows[0].invoice_number.split('/').pop(), 10);
  return `${prefix}${lastNumber + 1}`;
};

/**
 * Tworzy nową fakturę dla danego klienta i zakresu dat.
 * @param {number} customerId - ID klienta.
 * @param {string} startDate - Data początkowa (YYYY-MM-DD).
 * @param {string} endDate - Data końcowa (YYYY-MM-DD).
 * @returns {Promise<object>} Nowo utworzona faktura.
 */
const createInvoice = async (customerId, startDate, endDate) => {
  return db.withTransaction(async (client) => {
    // 1. Znajdź wszystkie niezapłacone zlecenia dla klienta w danym okresie.
    const ordersToInvoiceRes = await client.query(
      `SELECT id, final_price FROM orders 
       WHERE customer_id = $1 AND invoice_id IS NULL AND is_deleted = FALSE
       AND unloading_date_time >= $2 AND unloading_date_time <= $3`,
      [customerId, startDate, `${endDate}T23:59:59.999Z`]
    );

    const ordersToInvoice = ordersToInvoiceRes.rows;
    if (ordersToInvoice.length === 0) {
      throw new Error('No uninvoiced orders found for the selected customer and date range.');
    }

    // 2. Oblicz sumę i przygotuj pozycje faktury.
    const totalAmount = ordersToInvoice.reduce((sum, order) => sum + parseFloat(order.final_price || 0), 0);

    // 3. Wygeneruj numer faktury i datę płatności.
    const invoiceNumber = await getNextInvoiceNumber(client);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // Przykładowy termin płatności: 14 dni

    // 4. Wstaw nową fakturę do tabeli `invoices`.
    const invoiceRes = await client.query(
      `INSERT INTO invoices (invoice_number, customer_id, due_date, total_amount, status)
       VALUES ($1, $2, $3, $4, 'unpaid') RETURNING *`,
      [invoiceNumber, customerId, dueDate.toISOString().split('T')[0], totalAmount.toFixed(2)]
    );
    const newInvoice = invoiceRes.rows[0];

    // 5. Wstaw pozycje faktury i zaktualizuj zlecenia.
    for (const order of ordersToInvoice) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, order_id, amount) VALUES ($1, $2, $3)`,
        [newInvoice.id, order.id, order.final_price]
      );
      await client.query('UPDATE orders SET invoice_id = $1 WHERE id = $2', [newInvoice.id, order.id]);
    }

    return newInvoice;
  });
};

const findAllInvoices = async () => {
  const sql = `
    SELECT 
      i.*, 
      c.name as customer_name 
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.is_deleted = FALSE
    ORDER BY i.issue_date DESC, i.id DESC
  `;
  const { rows } = await db.query(sql);
  return rows;
};

module.exports = { createInvoice, findAllInvoices };