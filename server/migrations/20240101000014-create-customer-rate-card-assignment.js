// Plik server/migrations/YYYYMMDDHHMMSS-create-customer-rate-card-assignment.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customer_rate_card_assignments', {
      customer_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: 'customers', key: 'id' },
        onDelete: 'CASCADE'
      },
      rate_card_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'rate_cards', key: 'id' },
        onDelete: 'CASCADE'
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('customer_rate_card_assignments');
  }
};