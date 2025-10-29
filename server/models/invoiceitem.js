// Plik server/models/invoiceitem.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class InvoiceItem extends Model {
    static associate(models) {
      // Pozycja faktury należy do jednej faktury (Invoice)
      InvoiceItem.belongsTo(models.Invoice, {
        foreignKey: 'invoiceId',
        as: 'invoice',
      });
      // Pozycja faktury odnosi się do jednego zlecenia (Order)
      InvoiceItem.belongsTo(models.Order, {
        foreignKey: 'orderId',
        as: 'order',
      });
    }
  }
  InvoiceItem.init({
    invoiceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    description: DataTypes.TEXT,
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'InvoiceItem',
    tableName: 'invoice_items',
    timestamps: true, // Dodaje createdAt i updatedAt
    updatedAt: false, // Nie potrzebujemy updatedAt dla tej tabeli
    underscored: true,
  });
  return InvoiceItem;
};