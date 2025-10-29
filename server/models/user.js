// Plik server/models/user.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
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
      field: 'first_name', // Jawne określenie nazwy kolumny w bazie
    },
    lastName: {
      type: DataTypes.STRING,
      field: 'last_name',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'password_hash',
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user',
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_deleted',
    },
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users', // Jawnie określamy nazwę tabeli
    timestamps: true, // Automatycznie dodaje createdAt i updatedAt
    paranoid: true, // Włącza "soft delete" - `isDeleted` będzie zarządzane automatycznie
    deletedAt: 'isDeleted', // Używamy `isDeleted` zamiast domyślnego `deletedAt`
  });
  return User;
};