// Plik server/models/run.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Run extends Model {
    static associate(models) {
      // Przejazd należy do jednego pojazdu (Truck)
      Run.belongsTo(models.Truck, {
        foreignKey: 'truckId',
        as: 'truck',
      });
      // Przejazd należy do jednej naczepy (Trailer)
      Run.belongsTo(models.Trailer, {
        foreignKey: 'trailerId',
        as: 'trailer',
      });
      // Przejazd należy do jednego kierowcy (Driver)
      Run.belongsTo(models.Driver, {
        foreignKey: 'driverId',
        as: 'driver',
      });
      // Przejazd może mieć wiele przypisań (Assignments)
      Run.hasMany(models.Assignment, {
        foreignKey: 'runId',
        as: 'assignments',
      });
    }
  }
  Run.init({
    runDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    truckId: DataTypes.INTEGER,
    trailerId: DataTypes.INTEGER,
    driverId: DataTypes.INTEGER,
    status: {
      type: DataTypes.STRING,
      defaultValue: 'planned',
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'Run',
    tableName: 'runs',
    timestamps: true,
    paranoid: false, // isDeleted jako flaga bool
    underscored: true,
  });
  return Run;
};
