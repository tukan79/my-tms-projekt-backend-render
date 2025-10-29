// Plik server/models/rateentry.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RateEntry extends Model {
    static associate(models) {
      RateEntry.belongsTo(models.RateCard, {
        foreignKey: 'rateCardId',
        as: 'rateCard',
      });
      RateEntry.belongsTo(models.PostcodeZone, {
        foreignKey: 'zoneId',
        as: 'zone',
      });
    }
  }
  RateEntry.init({
    rateCardId: { type: DataTypes.INTEGER, allowNull: false },
    rateType: { type: DataTypes.STRING(50), allowNull: false },
    zoneId: { type: DataTypes.INTEGER, allowNull: false },
    serviceLevel: { type: DataTypes.STRING(10), allowNull: false },
    priceMicro: DataTypes.DECIMAL(10, 2),
    priceQuarter: DataTypes.DECIMAL(10, 2),
    priceHalf: DataTypes.DECIMAL(10, 2),
    priceHalfPlus: DataTypes.DECIMAL(10, 2),
    priceFull1: DataTypes.DECIMAL(10, 2),
    priceFull2: DataTypes.DECIMAL(10, 2),
    priceFull3: DataTypes.DECIMAL(10, 2),
    priceFull4: DataTypes.DECIMAL(10, 2),
    priceFull5: DataTypes.DECIMAL(10, 2),
    priceFull6: DataTypes.DECIMAL(10, 2),
    priceFull7: DataTypes.DECIMAL(10, 2),
    priceFull8: DataTypes.DECIMAL(10, 2),
    priceFull9: DataTypes.DECIMAL(10, 2),
    priceFull10: DataTypes.DECIMAL(10, 2),
  }, {
    sequelize,
    modelName: 'RateEntry',
    tableName: 'rate_entries',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['rate_card_id', 'rate_type', 'zone_id', 'service_level']
      }
    ]
  });
  return RateEntry;
};