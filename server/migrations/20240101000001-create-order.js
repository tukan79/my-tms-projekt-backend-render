// Plik server/migrations/YYYYMMDDHHMMSS-create-order.js
// (Zastąp YYYYMMDDHHMMSS aktualnym timestampem)
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      customer_id: {
        type: Sequelize.INTEGER,
        references: { model: 'customers', key: 'id' },
        onDelete: 'SET NULL',
      },
      order_number: {
        type: Sequelize.STRING,
        unique: true,
      },
      service_level: { type: Sequelize.STRING(10) },
      customer_reference: { type: Sequelize.STRING },
      status: {
        type: Sequelize.STRING(50),
        defaultValue: 'nowe',
      },
      sender_details: { type: Sequelize.JSONB },
      recipient_details: { type: Sequelize.JSONB },
      cargo_details: { type: Sequelize.JSONB },
      loading_date_time: { type: Sequelize.DATE },
      unloading_date_time: { type: Sequelize.DATE },
      unloading_start_time: { type: Sequelize.TIME },
      unloading_end_time: { type: Sequelize.TIME },
      selected_surcharges: { type: Sequelize.ARRAY(Sequelize.TEXT) },
      notes: { type: Sequelize.TEXT },
      calculated_price: { type: Sequelize.DECIMAL(10, 2) },
      final_price: { type: Sequelize.DECIMAL(10, 2) },
      invoice_id: {
        type: Sequelize.INTEGER,
        references: { model: 'invoices', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      is_deleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
    });

    // Dodajemy indeksy dla często wyszukiwanych kolumn
    await queryInterface.addIndex('orders', ['customer_id']);
    await queryInterface.addIndex('orders', ['created_by_user_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('orders');
  }
};