// Plik: server/models/bugreport.js
'use strict';
const { Model } = require('sequelize');

const defineBugReportModel = (sequelize, DataTypes) => {
  class BugReport extends Model {
    static associate(models) {
      // Zgłoszenie błędu należy do jednego użytkownika (User)
      BugReport.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'reporter',
      });
    }
  }
  BugReport.init({
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    context: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'new', // np. 'new', 'in_progress', 'resolved'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Zezwalamy na anonimowe zgłoszenia, jeśli zajdzie taka potrzeba
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
  }, {
    sequelize,
    modelName: 'BugReport',
    tableName: 'bug_reports',
    timestamps: true, // Automatycznie dodaje createdAt i updatedAt
    underscored: true,
  });
  return BugReport;
};

module.exports = defineBugReportModel;
