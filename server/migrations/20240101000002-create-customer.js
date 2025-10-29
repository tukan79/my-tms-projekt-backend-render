// Plik server/migrations/YYYYMMDDHHMMSS-create-customer.js
// (Zastąp YYYYMMDDHHMMSS aktualnym timestampem)
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      customer_code: {
        type: Sequelize.STRING(50),
        unique: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      address_line1: { type: Sequelize.TEXT },
      address_line2: { type: Sequelize.TEXT },
      address_line3: { type: Sequelize.TEXT },
      address_line4: { type: Sequelize.TEXT },
      postcode: { type: Sequelize.STRING(20) },
      phone_number: { type: Sequelize.STRING(50) },
      country_code: { type: Sequelize.STRING(10) },
      category: { type: Sequelize.STRING(100) },
      currency: { type: Sequelize.STRING(10) },
      pod_on_portal: { type: Sequelize.BOOLEAN, defaultValue: false },
      invoice_on_portal: { type: Sequelize.BOOLEAN, defaultValue: false },
      handheld_status_on_portal: { type: Sequelize.BOOLEAN, defaultValue: false },
      eta_status_on_portal: { type: Sequelize.BOOLEAN, defaultValue: false },
      general_status_on_portal: { type: Sequelize.BOOLEAN, defaultValue: false },
      status: {
        type: Sequelize.STRING(50),
        defaultValue: 'active'
      },
      vat_number: { type: Sequelize.STRING(50) },
      payment_terms: {
        type: Sequelize.INTEGER,
        defaultValue: 14
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      is_deleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }
    });

    // Dodajemy indeksy dla często wyszukiwanych kolumn
    await queryInterface.addIndex('customers', ['customer_code']);
    await queryInterface.addIndex('customers', ['name']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('customers');
  }
};