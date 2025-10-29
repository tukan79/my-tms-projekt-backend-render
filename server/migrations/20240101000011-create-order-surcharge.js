// Plik server/migrations/YYYYMMDDHHMMSS-create-order-surcharge.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('order_surcharges', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
        onDelete: 'CASCADE'
      },
      surcharge_type_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'surcharge_types', key: 'id' },
        onDelete: 'RESTRICT'
      },
      calculated_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      notes: { type: Sequelize.TEXT },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('order_surcharges');
  }
};