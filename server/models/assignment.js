// Plik server/models/assignment.js
'use strict';
const { Model } = require('sequelize');

const defineAssignmentModel = (sequelize, DataTypes) => {
  class Assignment extends Model {
    static associate(models) {
      // Przypisanie należy do jednego zlecenia (Order)
      Assignment.belongsTo(models.Order, {
        foreignKey: 'orderId',
        as: 'order',
      });
      // Przypisanie należy do jednego przejazdu (Run)
      Assignment.belongsTo(models.Run, {
        foreignKey: 'runId',
        as: 'run',
      });
    }
  }
  Assignment.init({
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    runId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    notes: DataTypes.TEXT,
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'Assignment',
    tableName: 'assignments',
    timestamps: true,
    paranoid: false, // używamy bool isDeleted jako flagi, nie timestampu
    underscored: true,
  });
  return Assignment;
};

module.exports = defineAssignmentModel;
