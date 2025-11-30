// Plik server/models/customer.js
'use strict';
const { Model } = require('sequelize');

const defineCustomerModel = (sequelize, DataTypes) => {
  class Customer extends Model {
    static associate(models) {
      // Klient (Customer) może mieć wiele zleceń (Orders)
      Customer.hasMany(models.Order, {
        foreignKey: 'customerId',
        as: 'orders',
      });

      // Klient może mieć wiele faktur (Invoices)
      Customer.hasMany(models.Invoice, {
        foreignKey: 'customerId',
        as: 'invoices',
      });

      // Klient ma przypisany jeden cennik (przez tabelę łączącą)
      Customer.hasOne(models.CustomerRateCardAssignment, {
        foreignKey: 'customerId',
        as: 'rateCardAssignment',
      });
    }
  }
  Customer.init({
    // Używamy camelCase, Sequelize zmapuje to na snake_case w bazie
    customerCode: {
      type: DataTypes.STRING(50),
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    addressLine1: DataTypes.TEXT,
    addressLine2: DataTypes.TEXT,
    addressLine3: DataTypes.TEXT,
    addressLine4: DataTypes.TEXT,
    postcode: DataTypes.STRING(20),
    phoneNumber: DataTypes.STRING(50),
    countryCode: DataTypes.STRING(10),
    category: DataTypes.STRING(100),
    currency: DataTypes.STRING(10),
    podOnPortal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    invoiceOnPortal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    handheldStatusOnPortal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    etaStatusOnPortal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    generalStatusOnPortal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'active',
    },
    vatNumber: DataTypes.STRING(50),
    paymentTerms: {
      type: DataTypes.INTEGER,
      defaultValue: 14,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'Customer',
    tableName: 'customers',
    timestamps: true,
    paranoid: false, // isDeleted to flaga bool, nie timestamp
    // Mapowanie camelCase na snake_case jest już włączone globalnie
    // w config/database.js, ale dla jasności można dodać mapowania pól:
    underscored: true,
  });
  return Customer;
};

module.exports = defineCustomerModel;
