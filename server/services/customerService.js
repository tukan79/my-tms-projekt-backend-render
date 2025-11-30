// Plik server/services/customerService.js
const { Customer, sequelize } = require('../models');

const toArrayPayload = (customersData) => {
  if (Array.isArray(customersData)) return customersData;
  if (Array.isArray(customersData?.customers)) return customersData.customers;
  if (typeof customersData === 'string') {
    try {
      const parsed = JSON.parse(customersData);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.customers)) return parsed.customers;
    } catch (err) {
      const parseErr = new Error('Invalid JSON payload for customers import');
      parseErr.status = 400;
      parseErr.cause = err;
      throw parseErr;
    }
  }
  const err = new Error('Invalid payload: expected array of customers or { customers: [...] }');
  err.status = 400;
  throw err;
};

const createCustomer = async (customerData) => {
  const {
    name, customer_code: customerCode, address_line1: addressLine1, address_line2: addressLine2, address_line3: addressLine3, address_line4: addressLine4, 
    postcode, phone_number: phoneNumber, country_code: countryCode, category, currency, vat_number: vatNumber, payment_terms: paymentTerms, status,
    pod_on_portal: podOnPortal, invoice_on_portal: invoiceOnPortal, handheld_status_on_portal: handheldStatusOnPortal, eta_status_on_portal: etaStatusOnPortal, general_status_on_portal: generalStatusOnPortal
  } = customerData;

  return Customer.create({
    name, customerCode, addressLine1, addressLine2, addressLine3, addressLine4, postcode, phoneNumber,
    countryCode, category, currency, vatNumber, paymentTerms, status, podOnPortal, invoiceOnPortal,
    handheldStatusOnPortal, etaStatusOnPortal, generalStatusOnPortal
  });
};

const findAllCustomers = async () => {
  // `paranoid: true` w modelu automatycznie dodaje warunek `is_deleted = FALSE`
  return Customer.findAll({
    order: [['name', 'ASC']],
  });
};

const updateCustomer = async (customerId, customerData) => {
  const {
    name, customer_code: customerCode, address_line1: addressLine1, address_line2: addressLine2, address_line3: addressLine3, address_line4: addressLine4, 
    postcode, phone_number: phoneNumber, country_code: countryCode, category, currency, vat_number: vatNumber, payment_terms: paymentTerms, status,
    pod_on_portal: podOnPortal, invoice_on_portal: invoiceOnPortal, handheld_status_on_portal: handheldStatusOnPortal, eta_status_on_portal: etaStatusOnPortal, general_status_on_portal: generalStatusOnPortal
  } = customerData;

  const dataToUpdate = {
    name, customerCode, addressLine1, addressLine2, addressLine3, addressLine4, postcode, phoneNumber,
    countryCode, category, currency, vatNumber, paymentTerms, status, podOnPortal, invoiceOnPortal,
    handheldStatusOnPortal, etaStatusOnPortal, generalStatusOnPortal
  };

  const [updatedRowsCount, updatedCustomers] = await Customer.update(
    dataToUpdate,
    {
      where: { id: customerId },
      returning: true,
    }
  );

  return updatedRowsCount > 0 ? updatedCustomers[0] : null;
};

const deleteCustomer = async (customerId) => {
  // `destroy` z `paranoid: true` w modelu wykona soft delete
  return Customer.destroy({ where: { id: customerId } });
};

const importCustomers = async (customersData) => {
  return sequelize.transaction(async (t) => {
    const errors = [];
    const customersArray = toArrayPayload(customersData);

    const toBoolean = (value) => {
      if (typeof value === 'string') {
        return ['true', 'yes', '1', 't', 'checked'].includes(value.toLowerCase());
      }
      return Boolean(value);
    };

    const customersToCreateOrUpdate = [];
    for (const [index, customerData] of customersArray.entries()) {
      // Walidacja podstawowych danych
      if (!customerData.customer_code || !customerData.name) {
        errors.push({ line: index + 2, message: 'Missing required fields: customer_code or name.' });
        continue; // Pomiń ten rekord
      }

      customersToCreateOrUpdate.push({
        customerCode: customerData.customer_code,
        name: customerData.name,
        addressLine1: customerData.address_line1 || null,
        addressLine2: customerData.address_line2 || null,
        addressLine3: customerData.address_line3 || null,
        addressLine4: customerData.address_line4 || null,
        postcode: customerData.postcode || null,
        phoneNumber: customerData.phone_number || null,
        countryCode: customerData.country_code || 'GB',
        category: customerData.category || null,
        currency: customerData.currency || 'GBP',
        status: customerData.status || 'active',
        vatNumber: customerData.vat_number || null,
        paymentTerms: customerData.payment_terms ? Number.parseInt(customerData.payment_terms, 10) : 14,
        podOnPortal: toBoolean(customerData.pod_on_portal || false),
        invoiceOnPortal: toBoolean(customerData.invoice_on_portal || false),
        handheldStatusOnPortal: toBoolean(customerData.handheld_status_on_portal || false),
        etaStatusOnPortal: toBoolean(customerData.eta_status_on_portal || false),
        generalStatusOnPortal: toBoolean(customerData.general_status_on_portal || false),
      });
    }

    if (customersToCreateOrUpdate.length === 0) {
      return { count: 0, importedIds: [], errors };
    }

    const importedCustomers = await Customer.bulkCreate(customersToCreateOrUpdate, {
      transaction: t,
      updateOnDuplicate: [
        'name', 'addressLine1', 'addressLine2', 'addressLine3', 'addressLine4', 'postcode', 'phoneNumber',
        'countryCode', 'category', 'currency', 'status', 'vatNumber', 'paymentTerms', 'podOnPortal',
        'invoiceOnPortal', 'handheldStatusOnPortal', 'etaStatusOnPortal', 'generalStatusOnPortal'
      ],
    });

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
