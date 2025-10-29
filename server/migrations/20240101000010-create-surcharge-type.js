// Plik server/migrations/YYYYMMDDHHMMSS-create-surcharge-type.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('surcharge_types', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      code: {
        type: Sequelize.STRING(10),
        unique: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: { type: Sequelize.TEXT },
      calculation_method: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      is_automatic: { type: Sequelize.BOOLEAN, defaultValue: false },
      requires_time: { type: Sequelize.BOOLEAN, defaultValue: false, allowNull: false },
      start_time: { type: Sequelize.TIME },
      end_time: { type: Sequelize.TIME },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('surcharge_types');
  }
};