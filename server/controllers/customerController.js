// Plik server/controllers/customerController.js
const customerService = require('../services/customerService.js');
const Papa = require('papaparse');
const fs = require('node:fs');
const path = require('node:path');

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
    const csv = Papa.unparse(customers.map(c => c.get({ plain: true }))); // Używamy get({ plain: true })

    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const filename = `customers_${timestamp}.csv`;
    const exportsDir = path.join(__dirname, '../exports');

    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const filePath = path.join(exportsDir, filename);
    fs.writeFileSync(filePath, csv, 'utf8');

    res.status(200).json({ message: `File successfully exported to server as ${filename}` });
  } catch (error) {
    console.error('Failed to export customers:', error);
    res.status(500).json({ error: 'An error occurred while exporting customers.' });
  }
};

exports.createCustomer = async (req, res, next) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }
    // Mapujemy snake_case z req.body na camelCase dla serwisu
    const newCustomer = await customerService.createCustomer({
      name: req.body.name, // Direct mapping
      customer_code: req.body.customer_code,
      address_line1: req.body.address_line1,
      address_line2: req.body.address_line2,
      address_line3: req.body.address_line3,
      address_line4: req.body.address_line4,
      postcode: req.body.postcode, // Direct mapping
      phone_number: req.body.phone_number,
      country_code: req.body.country_code,
      category: req.body.category, // Direct mapping
      currency: req.body.currency, // Direct mapping
      vat_number: req.body.vat_number,
      payment_terms: req.body.payment_terms,
      status: req.body.status, // Direct mapping
      pod_on_portal: req.body.pod_on_portal,
      invoice_on_portal: req.body.invoice_on_portal,
      handheld_status_on_portal: req.body.handheld_status_on_portal,
      eta_status_on_portal: req.body.eta_status_on_portal,
      general_status_on_portal: req.body.general_status_on_portal,
    });
    res.status(201).json(newCustomer);
  } catch (error) {
    next(error);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    // Mapujemy snake_case z req.body na camelCase dla serwisu
    const updatedCustomer = await customerService.updateCustomer(req.params.customerId, {
      name: req.body.name, // Direct mapping
      customer_code: req.body.customer_code,
      address_line1: req.body.address_line1,
      address_line2: req.body.address_line2,
      address_line3: req.body.address_line3,
      address_line4: req.body.address_line4,
      postcode: req.body.postcode, // Direct mapping
      phone_number: req.body.phone_number,
      country_code: req.body.country_code,
      category: req.body.category, // Direct mapping
      currency: req.body.currency, // Direct mapping
      vat_number: req.body.vat_number,
      payment_terms: req.body.payment_terms,
      status: req.body.status, // Direct mapping
      pod_on_portal: req.body.pod_on_portal,
      invoice_on_portal: req.body.invoice_on_portal,
      handheld_status_on_portal: req.body.handheld_status_on_portal,
      eta_status_on_portal: req.body.eta_status_on_portal,
      general_status_on_portal: req.body.general_status_on_portal,
    });
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
    res.status(201).json({ message: `Successfully imported ${result.count} customers.`, ...result });
  } catch (error) {
    next(error);
  }
};