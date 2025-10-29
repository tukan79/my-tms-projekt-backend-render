// Plik server/migrations/YYYYMMDDHHMMSS-create-postcode-zone.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('postcode_zones', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      zone_name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      postcode_patterns: { type: Sequelize.ARRAY(Sequelize.TEXT) },
      is_home_zone: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('postcode_zones');
  }
};