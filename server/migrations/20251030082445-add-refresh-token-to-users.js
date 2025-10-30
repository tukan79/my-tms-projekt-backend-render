'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'refresh_token', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'refresh_token');
  }
};