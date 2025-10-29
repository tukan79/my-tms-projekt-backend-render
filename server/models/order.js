// Plik server/models/order.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      // Zlecenie należy do jednego klienta (Customer)
      Order.belongsTo(models.Customer, {
        foreignKey: 'customerId',
        as: 'customer',
      });

      // Zlecenie zostało stworzone przez jednego użytkownika (User)
      Order.belongsTo(models.User, {
        foreignKey: 'createdByUserId',
        as: 'creator',
      });

      // Zlecenie może mieć wiele przypisań (Assignments)
      Order.hasMany(models.Assignment, {
        foreignKey: 'orderId',
        as: 'assignments',
      });

      // Zlecenie należy do jednej faktury (Invoice)
      Order.belongsTo(models.Invoice, {
        foreignKey: 'invoiceId',
        as: 'invoice',
      });

      // Zlecenie może mieć wiele dopłat
      Order.hasMany(models.OrderSurcharge, {
        foreignKey: 'orderId',
        as: 'surcharges',
      });
    }
  }
  Order.init({
    // Używamy camelCase, Sequelize zmapuje to na snake_case w bazie
    customerId: {
      type: DataTypes.INTEGER,
      references: { model: 'customers', key: 'id' },
      onDelete: 'SET NULL',
    },
    orderNumber: {
      type: DataTypes.STRING,
      unique: true,
    },
    serviceLevel: DataTypes.STRING(10),
    customerReference: DataTypes.STRING,
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'nowe',
    },
    senderDetails: DataTypes.JSONB,
    recipientDetails: DataTypes.JSONB,
    cargoDetails: DataTypes.JSONB,
    loadingDateTime: DataTypes.DATE,
    unloadingDateTime: DataTypes.DATE,
    unloadingStartTime: DataTypes.TIME,
    unloadingEndTime: DataTypes.TIME,
    selectedSurcharges: DataTypes.ARRAY(DataTypes.TEXT),
    notes: DataTypes.TEXT,
    calculatedPrice: DataTypes.DECIMAL(10, 2),
    finalPrice: DataTypes.DECIMAL(10, 2),
    invoiceId: {
      type: DataTypes.INTEGER,
      references: { model: 'invoices', key: 'id' },
      onDelete: 'SET NULL',
    },
    // Nowe pole do śledzenia, kto stworzył zlecenie
    createdByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Może być null, jeśli zlecenia są tworzone przez system
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    timestamps: true, // Automatycznie zarządza createdAt i updatedAt
    paranoid: true,   // Włącza "soft delete"
    deletedAt: 'isDeleted', // Używa `isDeleted` zamiast `deletedAt`
    // Mapowanie camelCase na snake_case jest już włączone globalnie w config/database.js
  });
  return Order;
};