// Plik server/migrations/YYYYMMDDHHMMSS-create-invoice-item.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoice_items', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      invoice_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
        onDelete: 'CASCADE'
      },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
        onDelete: 'RESTRICT'
      },
      description: { type: Sequelize.TEXT },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // Unikalny indeks, aby jedno zlecenie mogło być na jednej fakturze tylko raz
    await queryInterface.addConstraint('invoice_items', {
      fields: ['invoice_id', 'order_id'],
      type: 'unique',
      name: 'unique_invoice_order_item'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('invoice_items');
  }
};