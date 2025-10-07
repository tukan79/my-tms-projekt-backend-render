// Plik server/services/orderService.js
const db = require('../db/index.js');
const pricingService = require('./pricingService.js'); // Upewniamy się, że ścieżka jest jednoznaczna

const createOrder = async (orderData) => {
  const { customer_id, order_number, service_level, customer_reference, status, sender_details, recipient_details, cargo_details, loading_date_time, unloading_date_time } = orderData;

  const sql = `
    INSERT INTO orders (
      customer_id, order_number, service_level, customer_reference, status, sender_details, recipient_details, cargo_details, loading_date_time, unloading_date_time
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
  `;
  const { rows } = await db.query(sql, [
    customer_id,
    order_number,
    service_level,
    customer_reference,
    status,
    JSON.stringify(sender_details),
    JSON.stringify(recipient_details),
    JSON.stringify(cargo_details),
    loading_date_time,
    unloading_date_time,
  ]);

  const newOrder = rows[0];

  // Po utworzeniu zlecenia, uruchom silnik wyceny
  const price = await pricingService.calculateOrderPrice(newOrder);
  if (price !== null) {
    const updatePriceSql = 'UPDATE orders SET calculated_price = $1, final_price = $1 WHERE id = $2 RETURNING *';
    const updatedResult = await db.query(updatePriceSql, [price, newOrder.id]);
    return updatedResult.rows[0];
  }

  return newOrder;
};

const findAllOrders = async () => {
  const { rows } = await db.query('SELECT * FROM orders WHERE is_deleted = FALSE ORDER BY created_at DESC');
  return rows;
};

const updateOrder = async (orderId, orderData) => {
  const { customer_id, order_number, service_level, customer_reference, status, sender_details, recipient_details, cargo_details, loading_date_time, unloading_date_time, final_price } = orderData;

  const sql = `
    UPDATE orders
    SET 
      customer_id = $1, order_number = $2, service_level = $3, customer_reference = $4, status = $5, sender_details = $6, recipient_details = $7, cargo_details = $8, loading_date_time = $9, unloading_date_time = $10, final_price = $11,
      updated_at = NOW()
    WHERE id = $12
    RETURNING *
  `;

  const { rows } = await db.query(sql, [
    customer_id,
    order_number,
    service_level,
    customer_reference,
    status,
    JSON.stringify(sender_details),
    JSON.stringify(recipient_details),
    JSON.stringify(cargo_details),
    loading_date_time,
    unloading_date_time,
    final_price,
    orderId,
  ]);

  if (!rows[0]) return null;
  const updatedOrder = rows[0];

  // Po aktualizacji, przelicz cenę, jeśli nie została ona ręcznie zmieniona
  if (final_price === updatedOrder.calculated_price) {
    const price = await pricingService.calculateOrderPrice(updatedOrder);
    if (price !== null && price !== updatedOrder.calculated_price) {
      const updatePriceSql = 'UPDATE orders SET calculated_price = $1, final_price = $1 WHERE id = $2 RETURNING *';
      const updatedResult = await db.query(updatePriceSql, [price, updatedOrder.id]);
      return updatedResult.rows[0];
    }
  }

  return updatedOrder;
};

// Funkcje pomocnicze do bezpiecznej konwersji typów
const toInt = (value) => {
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
};

const toBoolean = (value) => {
  if (!value) return false; // Obsługuje null, undefined, ""
  if (typeof value === 'string') {
    return ['true', 'yes', '1', 't'].includes(value.toLowerCase());
  }
  return true; // Każda inna "prawdziwa" wartość
};

/**
 * Safely creates a Date object from date and time strings.
 * Returns null if the resulting date is invalid.
 * @param {string} dateStr - The date string (e.g., '2023-12-25').
 * @param {string} timeStr - The time string (e.g., '14:30:00').
 * @returns {Date|null} A valid Date object or null.
 */
const toDateTime = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T${timeStr || '12:00:00'}`);
  return isNaN(date.getTime()) ? null : date;
};

const importOrders = async (ordersData) => {
  // Używamy transakcji, aby zapewnić, że wszystkie zlecenia zostaną zaimportowane pomyślnie, lub żadne.
  return db.withTransaction(async (client) => {
    // Pobierz mapowanie kodów klientów na ich ID
    const { rows: customers } = await client.query('SELECT id, customer_code FROM customers');
    const customerCodeToIdMap = new Map(customers.map(c => [c.customer_code, c.id]));

    const importedOrders = [];
    const errors = [];
    const sql = `
      INSERT INTO orders (
        customer_id, order_number, customer_reference, status, sender_details, recipient_details, cargo_details, loading_date_time, unloading_date_time, service_level, calculated_price, final_price
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
      ON CONFLICT (order_number) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        customer_reference = EXCLUDED.customer_reference,
        status = EXCLUDED.status,
        sender_details = EXCLUDED.sender_details,
        recipient_details = EXCLUDED.recipient_details,
        cargo_details = EXCLUDED.cargo_details,
        loading_date_time = EXCLUDED.loading_date_time,
        unloading_date_time = EXCLUDED.unloading_date_time,
        service_level = EXCLUDED.service_level,
        calculated_price = EXCLUDED.calculated_price,
        final_price = EXCLUDED.final_price,
        updated_at = NOW()
      RETURNING *;
    `;

    for (const [index, order] of ordersData.entries()) {
      const customerId = customerCodeToIdMap.get(order.customer_code);
      if (!customerId) {
        errors.push({ line: index + 2, message: `Customer with code '${order.customer_code}' not found.` });
        continue;
      }

      // Calculate price before inserting
      const price = await pricingService.calculateOrderPrice({
        customer_id: customerId,
        sender_details: order.sender_details,
        recipient_details: order.recipient_details,
        cargo_details: order.cargo_details,
        service_level: order.service_level,
      });

      const result = await client.query(sql, [
        customerId,
        order.order_number,
        order.customer_reference,
        order.status,
        JSON.stringify(order.sender_details),
        JSON.stringify(order.recipient_details),
        JSON.stringify(order.cargo_details),
        order.loading_date_time,
        order.unloading_date_time,
        order.service_level,
        price,
      ]);

      if (result.rows.length > 0) {
        importedOrders.push(result.rows[0]);
      }
    }

    return { count: importedOrders.length, importedIds: importedOrders.map(o => o.id), errors };
  });
};

const deleteOrder = async (orderId) => {
  // Używamy "soft delete" dla spójności z innymi częściami aplikacji
  const sql = 'UPDATE orders SET is_deleted = TRUE WHERE id = $1';
  const result = await db.query(sql, [orderId]);
  return result.rowCount; // Zwraca 1 jeśli usunięto, 0 jeśli nie znaleziono
};

module.exports = { createOrder, findAllOrders, updateOrder, importOrders, deleteOrder };