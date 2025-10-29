// Plik server/migrations/YYYYMMDDHHMMSS-create-trailer.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('trailers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      registration_plate: {
        type: Sequelize.STRING(20),
        unique: true,
        allowNull: false
      },
      description: { type: Sequelize.TEXT },
      category: { type: Sequelize.STRING(100) },
      brand: { type: Sequelize.STRING(100) },
      max_payload_kg: { type: Sequelize.INTEGER },
      max_spaces: { type: Sequelize.INTEGER },
      length_m: { type: Sequelize.DECIMAL(5, 2) },
      width_m: { type: Sequelize.DECIMAL(5, 2) },
      height_m: { type: Sequelize.DECIMAL(5, 2) },
      weight_kg: { type: Sequelize.INTEGER },
      status: {
        type: Sequelize.STRING(50),
        defaultValue: 'inactive'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('trailers');
  }
};