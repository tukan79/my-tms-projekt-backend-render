const { User, sequelize } = require('../models');
const bcrypt = require('bcrypt');

const createUser = async (userData) => {
  const { email, password, role, first_name: firstName, last_name: lastName } = userData;
  // Logowanie diagnostyczne
  console.log('📝 REGISTER - Plain password:', password);
  const passwordHash = await bcrypt.hash(password, 10);
  console.log('🔐 REGISTER - Hashed password:', passwordHash);

  const newUser = await User.create({
    email: email.toLowerCase(), // Zapisujemy email małymi literami
    passwordHash: passwordHash,
    role: role,
    firstName: firstName,
    lastName: lastName,
  });

  return newUser;
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
    where: { email: email.toLowerCase() }, // Wyszukujemy po emailu z małymi literami
  });
};

/**
 * Weryfikuje dane logowania użytkownika i zwraca jego dane w przypadku sukcesu.
 * Zawiera szczegółowe logowanie do celów diagnostycznych.
 * @param {string} email - Adres email użytkownika.
 * @param {string} password - Hasło użytkownika.
 * @returns {Promise<object|null>} Obiekt użytkownika lub null.
 */
const loginUser = async (email, password) => {
  try {
    console.log('🔐 LOGIN ATTEMPT - Email:', email);

    const user = await User.findOne({
      where: { email: email.toLowerCase() },
    });

    console.log('👤 USER FOUND:', user ? 'YES - ' + user.email : 'NO');

    if (!user) {
      console.log('❌ LOGIN FAILED - User not found');
      return null;
    }

    console.log('🔑 PASSWORD COMPARISON:');
    console.log('   Stored hash:', user.passwordHash);
    console.log('   Provided password:', password);

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    console.log('✅ PASSWORD VALID:', isPasswordValid);

    return isPasswordValid ? user : null;
  } catch (error) {
    console.error('💥 LOGIN ERROR:', error);
    return null;
  }
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
  if (password && password.length > 0) {
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

const updateUserRefreshToken = async (userId, refreshToken) => {
  return User.update(
    { refreshToken },
    { where: { id: userId } }
  );
};

const findUserByRefreshToken = async (refreshToken) => {
  if (!refreshToken) return null;
  return User.findOne({
    where: { refreshToken },
  });
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
      // Pola do aktualizacji, jeśli użytkownik o danym `email` (unique key) już istnieje.
      // Celowo nie aktualizujemy `passwordHash`, aby import nie nadpisywał istniejących haseł.
      updateOnDuplicate: ['firstName', 'lastName', 'role'],
    });

    return { count: importedUsers.length, importedIds: importedUsers.map(u => u.id), errors };
  });
};

/**
 * Tworzy domyślnego użytkownika-administratora, jeśli nie istnieje.
 * Przydatne do inicjalizacji środowiska deweloperskiego.
 */
const createDefaultAdminUser = async () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@tms.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Password123!';
  
  try {
    const existingAdmin = await User.findOne({ where: { email: adminEmail.toLowerCase() } });
  
    if (existingAdmin) {
      // Jeśli użytkownik już istnieje, po prostu logujemy informację i kończymy.
      // This prevents the "unique constraint" error from appearing in logs on every start.
      console.log(`Default admin user '${adminEmail}' already exists. Skipping creation.`);
      return; // Zakończ funkcję, aby uniknąć dalszego przetwarzania
    } else {
      // Jeśli użytkownik nie istnieje, tworzymy go.
      console.log(`Creating default admin user: ${adminEmail}`);
      const newUser = await createUser({
        email: adminEmail.toLowerCase(),
        password: adminPassword,
        role: 'admin',
        firstName: 'Admin',
        lastName: 'User',
      });
      console.log(`Successfully created default admin user: ${newUser.email}`);
    }
  } catch (error) {
    // Obsługujemy błąd, jeśli wystąpił wyścig (race condition)
    // i inny proces utworzył użytkownika w międzyczasie.
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.warn(`Could not create default admin user '${adminEmail}' because it already exists (race condition).`);
    } else {
      console.error('Error creating default admin user:', error);
    }
  }
};

module.exports = {
  createUser,
  findAllUsers,
  findUserByEmailWithPassword,
  loginUser,
  findUserById,
  updateUser,
  deleteUser,
  importUsers,
  updateUserRefreshToken,
  findUserByRefreshToken,
  createDefaultAdminUser,
};