// Plik server/migrations/YYYYMMDDHHMMSS-create-run.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('runs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      run_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      truck_id: {
        type: Sequelize.INTEGER,
        references: { model: 'trucks', key: 'id' },
        onDelete: 'RESTRICT'
      },
      trailer_id: {
        type: Sequelize.INTEGER,
        references: { model: 'trailers', key: 'id' },
        onDelete: 'RESTRICT'
      },
      driver_id: {
        type: Sequelize.INTEGER,
        references: { model: 'drivers', key: 'id' },
        onDelete: 'RESTRICT'
      },
      status: {
        type: Sequelize.STRING(50),
        defaultValue: 'planned'
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
    await queryInterface.dropTable('runs');
  }
};