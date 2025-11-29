// Plik server/models/surchargetype.js
'use strict';
const { Model } = require('sequelize');

const defineSurchargeTypeModel = (sequelize, DataTypes) => {
  class SurchargeType extends Model {
    static associate(models) {
      // Typ dopłaty może być użyty w wielu pozycjach dopłat do zleceń
      SurchargeType.hasMany(models.OrderSurcharge, {
        foreignKey: 'surchargeTypeId',
        as: 'orderSurcharges',
      });
    }
  }
  SurchargeType.init({
    code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: DataTypes.TEXT,
    calculationMethod: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    isAutomatic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    requiresTime: DataTypes.BOOLEAN,
    startTime: DataTypes.TIME,
    endTime: DataTypes.TIME,
  }, {
    sequelize,
    modelName: 'SurchargeType',
    tableName: 'surcharge_types',
    timestamps: true,
    updatedAt: 'updated_at',
    createdAt: false, // Tabela w init.js nie ma createdAt
    underscored: true,
  });
  return SurchargeType;
};

module.exports = defineSurchargeTypeModel;
