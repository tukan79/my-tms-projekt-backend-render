// Plik server/models/postcodezone.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PostcodeZone extends Model {
    static associate(models) {
      PostcodeZone.hasMany(models.RateEntry, {
        foreignKey: 'zoneId',
        as: 'rateEntries',
      });
    }
  }
  PostcodeZone.init({
    zoneName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    postcodePatterns: DataTypes.ARRAY(DataTypes.TEXT),
    isHomeZone: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'PostcodeZone',
    tableName: 'postcode_zones',
    timestamps: true,
    underscored: true,
  });
  return PostcodeZone;
};