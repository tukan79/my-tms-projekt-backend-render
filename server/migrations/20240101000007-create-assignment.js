// Plik server/migrations/YYYYMMDDHHMMSS-create-assignment.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('assignments', {
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
      run_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'runs', key: 'id' },
        onDelete: 'CASCADE'
      },
      notes: {
        type: Sequelize.TEXT
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

    // Dodajemy unikalny indeks, aby jedno zlecenie mogło być przypisane do jednego przejazdu tylko raz
    await queryInterface.addConstraint('assignments', {
      fields: ['order_id', 'run_id'],
      type: 'unique',
      name: 'unique_order_run_assignment'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('assignments');
  }
};