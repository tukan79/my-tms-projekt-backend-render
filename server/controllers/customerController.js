// server/controllers/customerController.js

const customerService = require('../services/customerService.js');
const Papa = require('papaparse');
const fs = require('node:fs');
const path = require('node:path');

const allowedCustomerFields = [
  'name',
  'customer_code',
  'address_line1',
  'address_line2',
  'address_line3',
  'address_line4',
  'postcode',
  'phone_number',
  'country_code',
  'category',
  'currency',
  'vat_number',
  'payment_terms',
  'status',
  'pod_on_portal',
  'invoice_on_portal',
  'handheld_status_on_portal',
  'eta_status_on_portal',
  'general_status_on_portal',
];

function extractCustomerFields(body) {
  const data = {};
  for (const key of allowedCustomerFields) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  return data;
}

exports.getAllCustomers = async (req, res, next) => {
  try {
    const customers = await customerService.findAllCustomers();
    res.json({ customers: customers || [] });
  } catch (error) {
    next(error);
  }
};

exports.exportCustomers = async (req, res, next) => {
  try {
    const customers = await customerService.findAllCustomers();
    const csv = Papa.unparse(customers.map(c => c.get({ plain: true })));

    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const filename = `customers_${timestamp}.csv`;
    const exportsDir = path.join(__dirname, '../exports');

    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(exportsDir, filename), csv, 'utf8');

    res.status(200).json({ message: `File exported as ${filename}` });
  } catch (error) {
    console.error('Failed to export customers:', error);
    res.status(500).json({ error: 'Error exporting customers.' });
  }
};

exports.createCustomer = async (req, res, next) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }

    const payload = extractCustomerFields(req.body);
    const newCustomer = await customerService.createCustomer(payload);

    res.status(201).json(newCustomer);
  } catch (error) {
    next(error);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const payload = extractCustomerFields(req.body);

    const updatedCustomer = await customerService.updateCustomer(req.params.customerId, payload);

    if (!updatedCustomer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    res.json(updatedCustomer);
  } catch (error) {
    next(error);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const changes = await customerService.deleteCustomer(req.params.customerId);

    if (changes === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

exports.importCustomers = async (req, res, next) => {
  try {
    const result = await customerService.importCustomers(req.body);

    res.status(201).json({
      message: `Successfully imported ${result.count} customers.`,
      ...result
    });
  } catch (error) {
    next(error);
  }
};
