// Plik server/models/trailer.js
'use strict';
const { Model } = require('sequelize');

const defineTrailerModel = (sequelize, DataTypes) => {
  class Trailer extends Model {
    static associate(models) {
      // Naczepa może być przypisana do wielu przejazdów (Runs)
      Trailer.hasMany(models.Run, {
        foreignKey: 'trailerId',
        as: 'runs',
      });
    }
  }
  Trailer.init({
    registrationPlate: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: DataTypes.TEXT,
    category: DataTypes.STRING,
    brand: DataTypes.STRING,
    maxPayloadKg: DataTypes.INTEGER,
    maxSpaces: DataTypes.INTEGER,
    lengthM: DataTypes.DECIMAL(5, 2),
    widthM: DataTypes.DECIMAL(5, 2),
    heightM: DataTypes.DECIMAL(5, 2),
    weightKg: DataTypes.INTEGER,
    status: {
      type: DataTypes.STRING,
      defaultValue: 'inactive',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'Trailer',
    tableName: 'trailers',
    timestamps: true,
    paranoid: true,
    deletedAt: 'isDeleted',
    underscored: true,
  });
  return Trailer;
};

module.exports = defineTrailerModel;
