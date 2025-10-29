// Plik server/models/ordersurcharge.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderSurcharge extends Model {
    static associate(models) {
      OrderSurcharge.belongsTo(models.Order, {
        foreignKey: 'orderId',
        as: 'order',
      });
      OrderSurcharge.belongsTo(models.SurchargeType, {
        foreignKey: 'surchargeTypeId',
        as: 'surchargeType',
      });
    }
  }
  OrderSurcharge.init({
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    surchargeTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    calculatedAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    notes: DataTypes.TEXT,
  }, {
    sequelize,
    modelName: 'OrderSurcharge',
    tableName: 'order_surcharges',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });
  return OrderSurcharge;
};