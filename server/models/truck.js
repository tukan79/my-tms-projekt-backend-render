// Plik server/models/truck.js
'use strict';
const { Model } = require('sequelize');

const defineTruckModel = (sequelize, DataTypes) => {
  class Truck extends Model {
    static associate(models) {
      // Pojazd może być przypisany do wielu przejazdów (Runs)
      Truck.hasMany(models.Run, {
        foreignKey: 'truckId',
        as: 'runs',
      });
    }
  }
  Truck.init({
    brand: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    model: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    registrationPlate: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    vin: {
      type: DataTypes.STRING,
      unique: true,
    },
    productionYear: DataTypes.INTEGER,
    typeOfTruck: DataTypes.STRING,
    totalWeight: DataTypes.INTEGER,
    palletCapacity: DataTypes.INTEGER,
    maxPayloadKg: DataTypes.INTEGER,
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'Truck',
    tableName: 'trucks',
    timestamps: true,
    paranoid: true,
    deletedAt: 'isDeleted',
    underscored: true,
  });
  return Truck;
};

module.exports = defineTruckModel;
