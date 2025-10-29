// Plik server/migrations/YYYYMMDDHHMMSS-create-rate-entry.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rate_entries', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      rate_card_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'rate_cards', key: 'id' },
        onDelete: 'CASCADE'
      },
      rate_type: { type: Sequelize.STRING(50), allowNull: false },
      zone_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'postcode_zones', key: 'id' },
        onDelete: 'CASCADE'
      },
      service_level: { type: Sequelize.STRING(10), allowNull: false },
      price_micro: { type: Sequelize.DECIMAL(10, 2) },
      price_quarter: { type: Sequelize.DECIMAL(10, 2) },
      price_half: { type: Sequelize.DECIMAL(10, 2) },
      price_half_plus: { type: Sequelize.DECIMAL(10, 2) },
      price_full_1: { type: Sequelize.DECIMAL(10, 2) },
      price_full_2: { type: Sequelize.DECIMAL(10, 2) },
      price_full_3: { type: Sequelize.DECIMAL(10, 2) },
      price_full_4: { type: Sequelize.DECIMAL(10, 2) },
      price_full_5: { type: Sequelize.DECIMAL(10, 2) },
      price_full_6: { type: Sequelize.DECIMAL(10, 2) },
      price_full_7: { type: Sequelize.DECIMAL(10, 2) },
      price_full_8: { type: Sequelize.DECIMAL(10, 2) },
      price_full_9: { type: Sequelize.DECIMAL(10, 2) },
      price_full_10: { type: Sequelize.DECIMAL(10, 2) },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addConstraint('rate_entries', {
      fields: ['rate_card_id', 'rate_type', 'zone_id', 'service_level'],
      type: 'unique',
      name: 'unique_rate_entry_constraint'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('rate_entries');
  }
};