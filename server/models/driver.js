// Plik server/models/driver.js
'use strict';
const { Model } = require('sequelize');

const defineDriverModel = (sequelize, DataTypes) => {
  class Driver extends Model {
    static associate(models) {
      // Kierowca może być przypisany do wielu przejazdów (Runs)
      Driver.hasMany(models.Run, {
        foreignKey: 'driverId',
        as: 'runs',
      });
    }
  }
  Driver.init({
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phoneNumber: DataTypes.STRING,
    licenseNumber: DataTypes.STRING,
    cpcNumber: DataTypes.STRING,
    loginCode: {
      type: DataTypes.STRING,
      unique: true,
    },
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
    modelName: 'Driver',
    tableName: 'drivers',
    timestamps: true,
    paranoid: false, // isDeleted jako flaga bool
    underscored: true,
  });
  return Driver;
};

module.exports = defineDriverModel;
