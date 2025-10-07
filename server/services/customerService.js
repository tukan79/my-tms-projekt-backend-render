// Plik server/services/customerService.js
const db = require('../db/index.js');

const createCustomer = async (customerData) => {
  const { 
    name, customer_code, address_line1, address_line2, address_line3, address_line4, 
    postcode, phone_number, country_code, category, currency, vat_number, payment_terms, status,
    pod_on_portal, invoice_on_portal, handheld_status_on_portal, eta_status_on_portal, general_status_on_portal
  } = customerData;
  const sql = `
    INSERT INTO customers (
      name, customer_code, address_line1, address_line2, address_line3, address_line4, postcode, phone_number, 
      country_code, category, currency, vat_number, payment_terms, status, pod_on_portal, invoice_on_portal, 
      handheld_status_on_portal, eta_status_on_portal, general_status_on_portal
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *
  `;
  const { rows } = await db.query(sql, [
    name, customer_code, address_line1, address_line2, address_line3, address_line4, postcode, phone_number, 
    country_code, category, currency, vat_number, payment_terms, status, pod_on_portal, invoice_on_portal, 
    handheld_status_on_portal, eta_status_on_portal, general_status_on_portal
  ]);
  return rows[0];
};

const findAllCustomers = async () => {
  const { rows } = await db.query('SELECT * FROM customers WHERE is_deleted = FALSE ORDER BY name');
  return rows;
};

const updateCustomer = async (customerId, customerData) => {
  const { 
    name, customer_code, address_line1, address_line2, address_line3, address_line4, 
    postcode, phone_number, country_code, category, currency, vat_number, payment_terms, status,
    pod_on_portal, invoice_on_portal, handheld_status_on_portal, eta_status_on_portal, general_status_on_portal
  } = customerData;
  const sql = `
    UPDATE customers
    SET name = $1, customer_code = $2, address_line1 = $3, address_line2 = $4, address_line3 = $5, address_line4 = $6, 
        postcode = $7, phone_number = $8, country_code = $9, category = $10, currency = $11, vat_number = $12, 
        payment_terms = $13, status = $14, pod_on_portal = $15, invoice_on_portal = $16, handheld_status_on_portal = $17, 
        eta_status_on_portal = $18, general_status_on_portal = $19, updated_at = NOW()
    WHERE id = $20 RETURNING *
  `;
  const { rows } = await db.query(sql, [
    name, customer_code, address_line1, address_line2, address_line3, address_line4, postcode, phone_number, 
    country_code, category, currency, vat_number, payment_terms, status, pod_on_portal, invoice_on_portal, 
    handheld_status_on_portal, eta_status_on_portal, general_status_on_portal, customerId
  ]);
  return rows.length > 0 ? rows[0] : null;
};

const deleteCustomer = async (customerId) => {
  const sql = 'UPDATE customers SET is_deleted = TRUE WHERE id = $1';
  const result = await db.query(sql, [customerId]);
  return result.rowCount;
};

const importCustomers = async (customersData) => {
  return db.withTransaction(async (client) => {
    const importedCustomers = [];
    const errors = [];
    const sql = `
      INSERT INTO customers (
        customer_code, name, address_line1, address_line2, address_line3, address_line4, 
        postcode, phone_number, country_code, category, currency, status, vat_number, payment_terms,
        pod_on_portal, invoice_on_portal, handheld_status_on_portal, eta_status_on_portal, general_status_on_portal
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (customer_code) DO UPDATE SET
        name = EXCLUDED.name,
        address_line1 = EXCLUDED.address_line1,
        address_line2 = EXCLUDED.address_line2,
        address_line3 = EXCLUDED.address_line3,
        address_line4 = EXCLUDED.address_line4,
        postcode = EXCLUDED.postcode,
        phone_number = EXCLUDED.phone_number,
        country_code = EXCLUDED.country_code,
        category = EXCLUDED.category,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        vat_number = EXCLUDED.vat_number,
        payment_terms = EXCLUDED.payment_terms,
        pod_on_portal = EXCLUDED.pod_on_portal,
        invoice_on_portal = EXCLUDED.invoice_on_portal,
        handheld_status_on_portal = EXCLUDED.handheld_status_on_portal,
        eta_status_on_portal = EXCLUDED.eta_status_on_portal,
        general_status_on_portal = EXCLUDED.general_status_on_portal,
        updated_at = NOW()
      RETURNING id, name;
    `;

    const toBoolean = (value) => {
      if (typeof value === 'string') {
        return ['true', 'yes', '1', 't', 'checked'].includes(value.toLowerCase());
      }
      return Boolean(value);
    };

    for (const [index, customerData] of customersData.entries()) {
      // Walidacja podstawowych danych
      if (!customerData.customer_code || !customerData.name) {
        errors.push({ line: index + 2, message: 'Missing required fields: customer_code or name.' });
        continue; // Pomiń ten rekord
      }

      const result = await client.query(sql, [
        customerData.customer_code,
        customerData.name,
        customerData.address_line1 || null,
        customerData.address_line2 || null,
        customerData.address_line3 || null,
        customerData.address_line4 || null,
        customerData.postcode || null,
        customerData.phone_number || null,
        customerData.country_code || 'GB',
        customerData.category || null,
        customerData.currency || 'GBP',
        customerData.status || 'active',
        customerData.vat_number || null,
        customerData.payment_terms ? parseInt(customerData.payment_terms, 10) : 14,
        toBoolean(customerData.pod_on_portal || false),
        toBoolean(customerData.invoice_on_portal || false),
        toBoolean(customerData.handheld_status_on_portal || false),
        toBoolean(customerData.eta_status_on_portal || false),
        toBoolean(customerData.general_status_on_portal || false)
      ]);
      if (result.rows.length > 0) {
        importedCustomers.push(result.rows[0]);
      }
    }
    return { count: importedCustomers.length, importedIds: importedCustomers.map(c => c.id), errors };
  });
};

module.exports = {
  createCustomer,
  findAllCustomers,
  updateCustomer,
  deleteCustomer,
  importCustomers,
};