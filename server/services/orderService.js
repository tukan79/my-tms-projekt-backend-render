// Plik server/services/orderService.js
const db = require('../db/index.js');
const pricingService = require('./pricingService.js'); // Upewniamy się, że ścieżka jest jednoznaczna

const createOrder = async (orderData) => {
  return db.withTransaction(async (client) => {
    const { customer_id, order_number, service_level, customer_reference, status, sender_details, recipient_details, cargo_details, loading_date_time, unloading_date_time, selected_surcharges, unloading_start_time, unloading_end_time } = orderData;

    // Krok 1: Utwórz zlecenie
    const orderSql = `
      INSERT INTO orders (
        customer_id, order_number, service_level, customer_reference, status, sender_details, recipient_details, cargo_details, loading_date_time, unloading_date_time, selected_surcharges, unloading_start_time, unloading_end_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *
    `;
    const orderResult = await client.query(orderSql, [
      customer_id, order_number, service_level, customer_reference, status,
      JSON.stringify(sender_details), JSON.stringify(recipient_details), JSON.stringify(cargo_details),
      // Poprawka: Upewniamy się, że data jest traktowana jako data lokalna, a nie timestamp UTC.
      loading_date_time ? loading_date_time.split('T')[0] : null, 
      unloading_date_time ? unloading_date_time.split('T')[0] : null, selected_surcharges || [],
      unloading_start_time || null, unloading_end_time || null,
    ]);
    const newOrder = orderResult.rows[0];

    // Krok 2: Oblicz cenę i dopłaty
    const priceResult = await pricingService.calculateOrderPrice(newOrder);
    if (!priceResult) {
      return newOrder; // Zwróć zlecenie bez ceny, jeśli wycena się nie powiodła
    }

    // Krok 3: Zapisz dopłaty w tabeli order_surcharges
    if (priceResult.breakdown?.surcharges?.length > 0) {
      const surchargeInsertSql = `
        INSERT INTO order_surcharges (order_id, surcharge_type_id, calculated_amount)
        VALUES ($1, $2, $3)
      `;
      for (const surcharge of priceResult.breakdown.surcharges) {
        await client.query(surchargeInsertSql, [newOrder.id, surcharge.surcharge_type_id, surcharge.amount]);
      }
    }

    // Krok 4: Zaktualizuj zlecenie o obliczoną cenę i szczegóły wyceny
    const updatedCargoDetails = { ...newOrder.cargo_details, price_breakdown: priceResult.breakdown };
    const updatePriceSql = `
      UPDATE orders 
      SET calculated_price = $1, final_price = $2, cargo_details = $3
      WHERE id = $4 RETURNING *;
    `;
    const updatedResult = await client.query(updatePriceSql, [
      priceResult.calculatedPrice,
      priceResult.finalPrice,
      JSON.stringify(updatedCargoDetails),
      newOrder.id
    ]);

    return updatedResult.rows[0];
  });
};

const findAllOrders = async () => {
  const { rows } = await db.query('SELECT * FROM orders WHERE is_deleted = FALSE ORDER BY created_at DESC');
  return rows;
};

const updateOrder = async (orderId, orderData) => {
  return db.withTransaction(async (client) => {
    // Krok 1: Pobierz aktualny stan zlecenia z bazy danych.
    const existingOrderRes = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (existingOrderRes.rows.length === 0) {
      return null; // Zlecenie nie istnieje
    }
    const existingOrder = existingOrderRes.rows[0];

    // OSTATECZNA POPRAWKA: Używamy `toLocaleDateString` z odpowiednim formatowaniem,
    // aby uzyskać datę w formacie YYYY-MM-DD bez wpływu strefy czasowej.
    if (existingOrder.loading_date_time) {
      const d = new Date(existingOrder.loading_date_time);
      existingOrder.loading_date_time = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (existingOrder.unloading_date_time) {
      const d = new Date(existingOrder.unloading_date_time);
      existingOrder.unloading_date_time = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // Krok 2: Połącz istniejące dane z nowymi danymi z formularza.
    const mergedOrderData = { ...existingOrder, ...orderData };

    // Krok 3: Sprawdź, czy należy przeliczyć cenę.
    // Porównujemy kluczowe pola, które mają wpływ na cenę.
    const shouldRecalculatePrice = (
      JSON.stringify(existingOrder.cargo_details) !== JSON.stringify(orderData.cargo_details) ||
      existingOrder.sender_details?.postCode !== orderData.sender_details?.postCode ||
      existingOrder.recipient_details?.postCode !== orderData.recipient_details?.postCode ||
      existingOrder.service_level !== orderData.service_level ||
      JSON.stringify(existingOrder.selected_surcharges) !== JSON.stringify(orderData.selected_surcharges)
    );

    let priceResult = null;
    if (shouldRecalculatePrice) {
      console.log('🔄 Price-affecting field changed. Recalculating price...');
      try {
        priceResult = await pricingService.calculateOrderPrice(mergedOrderData);
      } catch (error) {
        // Zamiast rzucać błędem 500, logujemy go i kontynuujemy bez ceny.
        // To zapobiega awarii całego procesu aktualizacji zlecenia.
        console.error(`⚠️ PRICING SKIPPED during update:`, error.message);
        priceResult = null; // Ustawiamy priceResult na null, aby reszta funkcji działała poprawnie.
      }
    } else {
      console.log('✅ No price-affecting fields changed. Skipping price recalculation.');
      // Jeśli nie przeliczamy, użyjemy istniejących cen i szczegółów wyceny.
      priceResult = { calculatedPrice: existingOrder.calculated_price, finalPrice: existingOrder.final_price, breakdown: existingOrder.cargo_details?.price_breakdown };
    }

    // Krok 4: Przygotuj ostateczne dane do zapisu.
    let finalCalculatedPrice = mergedOrderData.calculated_price;
    let finalFinalPrice = mergedOrderData.final_price;

    if (priceResult && priceResult.calculatedPrice > 0) {
      const hasManualPriceOverride = 'final_price' in orderData &&
                                     orderData.final_price !== '' &&
                                     parseFloat(orderData.final_price) !== priceResult.finalPrice;

      if (hasManualPriceOverride) {
        finalCalculatedPrice = priceResult.calculatedPrice;
        finalFinalPrice = parseFloat(orderData.final_price);
      } else {
        finalCalculatedPrice = priceResult.calculatedPrice;
        finalFinalPrice = priceResult.finalPrice;
      }

      mergedOrderData.cargo_details = {
        ...mergedOrderData.cargo_details,
        price_breakdown: priceResult.breakdown
      };
    }

    // Krok 5: Zaktualizuj główne dane zlecenia.
    const updateOrderSql = `
      UPDATE orders
      SET 
        customer_id = $1, order_number = $2, service_level = $3, customer_reference = $4, status = $5, 
        sender_details = $6, recipient_details = $7, cargo_details = $8, 
        loading_date_time = $9, unloading_date_time = $10, 
        calculated_price = $11, final_price = $12,
        selected_surcharges = $13, unloading_start_time = $14, unloading_end_time = $15,
        updated_at = NOW()
      WHERE id = $16
      RETURNING *
    `;
    const { rows } = await client.query(updateOrderSql, [
      mergedOrderData.customer_id, mergedOrderData.order_number, mergedOrderData.service_level, 
      mergedOrderData.customer_reference, mergedOrderData.status, 
      JSON.stringify(mergedOrderData.sender_details), JSON.stringify(mergedOrderData.recipient_details), 
      JSON.stringify(mergedOrderData.cargo_details), 
      // Poprawka: Upewniamy się, że data jest traktowana jako data lokalna.
      mergedOrderData.loading_date_time ? mergedOrderData.loading_date_time.split('T')[0] : null, 
      mergedOrderData.unloading_date_time ? mergedOrderData.unloading_date_time.split('T')[0] : null, 
      finalCalculatedPrice, finalFinalPrice, 
      mergedOrderData.selected_surcharges || [],
      mergedOrderData.unloading_start_time || null, mergedOrderData.unloading_end_time || null,
      orderId,
    ]);

    if (rows.length === 0) {
      return null;
    }

    // Krok 6: Zaktualizuj powiązane dopłaty w tabeli order_surcharges.
    // Najpierw usuwamy stare, potem dodajemy nowe.
    await client.query('DELETE FROM order_surcharges WHERE order_id = $1', [orderId]);

    if (priceResult?.breakdown?.surcharges?.length > 0) {
      const surchargeInsertSql = `
        INSERT INTO order_surcharges (order_id, surcharge_type_id, calculated_amount)
        VALUES ($1, $2, $3)
      `;
      for (const surcharge of priceResult.breakdown.surcharges) {
        await client.query(surchargeInsertSql, [orderId, surcharge.surcharge_type_id, surcharge.amount]);
      }
    }

    return rows[0];
  });
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
        customer_id, order_number, customer_reference, status, sender_details, recipient_details, cargo_details, loading_date_time, unloading_date_time, service_level, selected_surcharges, calculated_price, final_price, unloading_start_time, unloading_end_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      -- Poprawka: Używamy ID jako głównego identyfikatora konfliktu, jeśli jest dostępny.
      -- To pozwala na aktualizację istniejących zleceń, nawet jeśli order_number się zmienia.
      ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        customer_reference = EXCLUDED.customer_reference,
        status = EXCLUDED.status,
        sender_details = EXCLUDED.sender_details,
        recipient_details = EXCLUDED.recipient_details,
        cargo_details = EXCLUDED.cargo_details,
        loading_date_time = EXCLUDED.loading_date_time,
        unloading_date_time = EXCLUDED.unloading_date_time,
        service_level = EXCLUDED.service_level,
        selected_surcharges = EXCLUDED.selected_surcharges,
        calculated_price = EXCLUDED.calculated_price,
        final_price = EXCLUDED.final_price, 
        unloading_start_time = EXCLUDED.unloading_start_time,
        unloading_end_time = EXCLUDED.unloading_end_time,
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
      const priceResult = await pricingService.calculateOrderPrice({
        customer_id: customerId,
        sender_details: order.sender_details,
        recipient_details: order.recipient_details,
        cargo_details: order.cargo_details,
        selected_surcharges: order.selected_surcharges || [], // Przekazujemy dopłaty z pliku CSV
        service_level: order.service_level,
        unloading_start_time: order.unloading_start_time,
        unloading_end_time: order.unloading_end_time,
      });
      const updatedCargoDetails = priceResult ? { ...order.cargo_details, price_breakdown: priceResult.breakdown } : order.cargo_details;

      const result = await client.query(sql, [
        customerId,
        order.order_number,
        order.customer_reference,
        order.status,
        JSON.stringify(order.sender_details),
        JSON.stringify(order.recipient_details),
        JSON.stringify(updatedCargoDetails),
        order.loading_date_time,
        order.unloading_date_time,
        order.service_level,
        order.selected_surcharges || [],
        priceResult ? priceResult.calculatedPrice : null,
        priceResult ? priceResult.finalPrice : null,
        order.unloading_start_time || null, // Konwertuj pusty string na null
        order.unloading_end_time || null,   // Konwertuj pusty string na null
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

const bulkDeleteOrders = async (orderIds) => {
  if (!orderIds || orderIds.length === 0) return 0;
  const sql = 'UPDATE orders SET is_deleted = TRUE WHERE id = ANY($1::int[])';
  const result = await db.query(sql, [orderIds]);
  return result.rowCount;
};

module.exports = { createOrder, findAllOrders, updateOrder, importOrders, deleteOrder, bulkDeleteOrders };