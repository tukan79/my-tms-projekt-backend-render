const { User, sequelize } = require('../models');
const bcrypt = require('bcryptjs');

const createUser = async (userData) => {
  const { email, password, role, first_name: firstName, last_name: lastName } = userData;
  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    email,
    passwordHash,
    role,
    firstName,
    lastName,
  });

  // Zwracamy obiekt bez hasła
  const { passwordHash: _, ...userWithoutPassword } = newUser.get({ plain: true });
  return userWithoutPassword;
};

const findAllUsers = async () => {
  // `paranoid: true` w modelu automatycznie dodaje warunek `is_deleted = FALSE`
  return User.findAll({
    attributes: { exclude: ['passwordHash'] }, // Nie zwracamy hasha hasła
    order: [['lastName', 'ASC'], ['firstName', 'ASC']],
  });
};

const findUserByEmailWithPassword = async (email) => {
  // Ta funkcja jako jedyna powinna zwracać hash hasła do weryfikacji
  return User.findOne({
    where: { email },
  });
};

const findUserById = async (userId) => {
  return User.findByPk(userId, {
    attributes: { exclude: ['passwordHash'] },
  });
};

const updateUser = async (userId, userData) => {
  const { first_name: firstName, last_name: lastName, role, password } = userData;

  const fieldsToUpdate = {};
  if (firstName !== undefined) fieldsToUpdate.firstName = firstName;
  if (lastName !== undefined) fieldsToUpdate.lastName = lastName;
  if (role !== undefined) fieldsToUpdate.role = role;

  // Jeśli hasło jest podane, haszujemy je przed aktualizacją.
  if (password) {
    fieldsToUpdate.passwordHash = await bcrypt.hash(password, 10);
  }

  const fieldKeys = Object.keys(fieldsToUpdate);
  if (fieldKeys.length === 0) {
    return findUserById(userId);
  }

  const [updatedRowsCount, updatedUsers] = await User.update(
    fieldsToUpdate,
    {
      where: { id: userId },
      returning: true,
    }
  );

  if (updatedRowsCount > 0) {
    const { passwordHash: _, ...userWithoutPassword } = updatedUsers[0].get({ plain: true });
    return userWithoutPassword;
  }
  return null;
};

const deleteUser = async (userId) => {
  // `destroy` z `paranoid: true` w modelu wykona soft delete
  return User.destroy({ where: { id: userId } });
};

const importUsers = async (usersData) => {
  return sequelize.transaction(async (t) => {
    const errors = [];
    const usersToCreateOrUpdate = [];

    for (const [index, user] of usersData.entries()) {
      if (!user.email || !user.password || !user.role || !user.first_name || !user.last_name) {
        errors.push({ line: index + 2, message: 'Missing required fields.' });
        continue;
      }
      if (user.password.length < 6) {
        errors.push({ line: index + 2, message: `Password for ${user.email} is too short (min 6 chars).` });
        continue;
      }

      const passwordHash = await bcrypt.hash(user.password, 10);
      usersToCreateOrUpdate.push({
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        passwordHash: passwordHash,
        role: user.role,
      });
    }

    if (usersToCreateOrUpdate.length === 0) {
      return { count: 0, importedIds: [], errors };
    }

    // Używamy `bulkCreate` z opcją `updateOnDuplicate`, aby obsłużyć konflikty
    const importedUsers = await User.bulkCreate(usersToCreateOrUpdate, {
      transaction: t,
      updateOnDuplicate: ['firstName', 'lastName', 'role'], // Nie aktualizujemy hasła przy konflikcie
    });

    return { count: importedUsers.length, importedIds: importedUsers.map(u => u.id), errors };
  });
};

module.exports = {
  createUser,
  findAllUsers,
  findUserByEmailWithPassword,
  findUserById,
  updateUser,
  deleteUser,
  importUsers
};