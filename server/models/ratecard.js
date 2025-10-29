// Plik server/models/ratecard.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RateCard extends Model {
    static associate(models) {
      RateCard.hasMany(models.RateEntry, {
        foreignKey: 'rateCardId',
        as: 'entries',
      });
      RateCard.hasMany(models.CustomerRateCardAssignment, {
        foreignKey: 'rateCardId',
        as: 'customerAssignments',
      });
    }
  }
  RateCard.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  }, {
    sequelize,
    modelName: 'RateCard',
    tableName: 'rate_cards',
    timestamps: true,
    underscored: true,
  });
  return RateCard;
};