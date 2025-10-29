// Plik server/models/customerratecardassignment.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CustomerRateCardAssignment extends Model {
    static associate(models) {
      CustomerRateCardAssignment.belongsTo(models.Customer, {
        foreignKey: 'customerId',
        as: 'customer',
      });
      CustomerRateCardAssignment.belongsTo(models.RateCard, {
        foreignKey: 'rateCardId',
        as: 'rateCard',
      });
    }
  }
  CustomerRateCardAssignment.init({
    customerId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    rateCardId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'CustomerRateCardAssignment',
    tableName: 'customer_rate_card_assignments',
    timestamps: true,
    underscored: true,
  });
  return CustomerRateCardAssignment;
};