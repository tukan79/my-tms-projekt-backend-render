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
    priceFull1: { type: DataTypes.DECIMAL(10, 2), field: 'price_full_1' },
    priceFull2: { type: DataTypes.DECIMAL(10, 2), field: 'price_full_2' },
    priceFull3: { type: DataTypes.DECIMAL(10, 2), field: 'price_full_3' },
    priceFull4: { type: DataTypes.DECIMAL(10, 2), field: 'price_full_4' },
    priceFull5: { type: DataTypes.DECIMAL(10, 2), field: 'price_full_5' },
    priceFull6: { type: DataTypes.DECIMAL(10, 2), field: 'price_full_6' },
    priceFull7: { type: DataTypes.DECIMAL(10, 2), field: 'price_full_7' },
    priceFull8: { type: DataTypes.DECIMAL(10, 2), field: 'price_full_8' },
    priceFull9: { type: DataTypes.DECIMAL(10, 2), field: 'price_full_9' },
    priceFull10: { type: DataTypes.DECIMAL(10, 2), field: 'price_full_10' },
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
