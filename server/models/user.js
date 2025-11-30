// Plik server/models/user.js
'use strict';
const { Model } = require('sequelize');

const defineUserModel = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index.js` file will call this method automatically.
     */
    static associate(models) {
      // Użytkownik może stworzyć wiele zleceń (Orders)
      User.hasMany(models.Order, {
        foreignKey: 'createdByUserId',
        as: 'createdOrders',
      });
    }
  }
  User.init({
    // Nazwy pól są w camelCase, ale Sequelize automatycznie
    // zmapuje je na snake_case w bazie danych (np. firstName -> first_name)
    // dzięki opcji `underscored: true` w config/database.js
    firstName: {
      type: DataTypes.STRING,
    },
    lastName: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user',
    },
    refreshToken: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users', // Jawnie określamy nazwę tabeli
    timestamps: true, // Automatycznie dodaje createdAt i updatedAt
    paranoid: false, // isDeleted traktujemy jako flaga bool
    underscored: true, // Zapewnia, że wszystkie pola (np. createdAt) będą w snake_case
  });
  return User;
};

module.exports = defineUserModel;
