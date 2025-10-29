// Plik server/models/invoice.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Invoice extends Model {
    static associate(models) {
      // Faktura należy do jednego klienta (Customer)
      Invoice.belongsTo(models.Customer, {
        foreignKey: 'customerId',
        as: 'customer',
      });

      // Faktura ma wiele pozycji (InvoiceItem)
      Invoice.hasMany(models.InvoiceItem, {
        foreignKey: 'invoiceId',
        as: 'items',
      });

      // Faktura jest powiązana z wieloma zleceniami (Orders)
      Invoice.hasMany(models.Order, {
        foreignKey: 'invoiceId',
        as: 'orders',
      });
    }
  }
  Invoice.init({
    invoiceNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    issueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: DataTypes.STRING(50),
    notes: DataTypes.TEXT,
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'Invoice',
    tableName: 'invoices',
    timestamps: true,
    paranoid: true,
    deletedAt: 'isDeleted',
    underscored: true,
  });
  return Invoice;
};