// Plik server/migrations/YYYYMMDDHHMMSS-create-truck.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('trucks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      brand: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      model: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      registration_plate: {
        type: Sequelize.STRING(20),
        unique: true,
        allowNull: false
      },
      vin: {
        type: Sequelize.STRING(17),
        unique: true
      },
      production_year: { type: Sequelize.INTEGER },
      type_of_truck: { type: Sequelize.STRING(50), defaultValue: 'tractor' },
      total_weight: { type: Sequelize.INTEGER },
      pallet_capacity: { type: Sequelize.INTEGER },
      max_payload_kg: { type: Sequelize.INTEGER },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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
    await queryInterface.dropTable('trucks');
  }
};