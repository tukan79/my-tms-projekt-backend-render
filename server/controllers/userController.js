// Plik: server/controllers/userController.js
const userService = require('../services/userService.js');
const Papa = require('papaparse');

// Helper: transformacja użytkownika na snake_case
const toSnakeCaseUser = (user) => {
  if (!user) return null;
  const plain = typeof user.get === 'function' ? user.get({ plain: true }) : user;
  const { firstName = '', lastName = '', ...rest } = plain;
  return {
    ...rest,
    first_name: firstName,
    last_name: lastName,
  };
};

// --- GET ALL USERS ---
const getAllUsers = async (req, res, next) => {
  try {
    const users = await userService.findAllUsers();
    res.status(200).json(users ? users.map(toSnakeCaseUser) : []);
  } catch (error) {
    next(error);
  }
};

// --- CREATE USER ---
const createUser = async (req, res, next) => {
  try {
    const { email, role, first_name, last_name, password } = req.body;
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'Required fields: email, password, first_name, last_name.' });
    }

    const newUser = await userService.createUser({
      email,
      password,
      role,
      firstName: first_name,
      lastName: last_name,
    });

    res.status(201).json(toSnakeCaseUser(newUser));
  } catch (error) {
    next(error);
  }
};

// --- UPDATE USER ---
const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const updatedUser = await userService.updateUser(userId, req.body);
    if (!updatedUser) return res.status(404).json({ error: 'User not found.' });
    res.status(200).json(toSnakeCaseUser(updatedUser));
  } catch (error) {
    next(error);
  }
};

// --- DELETE USER ---
const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const deletedCount = await userService.deleteUser(userId);
    if (deletedCount === 0) return res.status(404).json({ error: 'User not found.' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// --- IMPORT USERS (CSV) ---
const importUsers = async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  try {
    const csvData = req.file.buffer.toString('utf-8');
    const parsedData = Papa.parse(csvData, { header: true, skipEmptyLines: true });

    if (parsedData.errors.length > 0) {
      return res.status(400).json({ error: 'Error parsing CSV file.', details: parsedData.errors });
    }

    // Optional: walidacja podstawowych pól
    const validUsers = parsedData.data.filter(u => u.email && u.firstName && u.lastName);
    const result = await userService.importUsers(validUsers);

    res.status(201).json({
      message: `Successfully processed file. Imported or updated ${result.count} users.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// --- EXPORT USERS (CSV) ---
const exportUsers = async (req, res, next) => {
  try {
    const users = (await userService.findAllUsers()).map(u => u.get({ plain: true }));
    const fields = ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt', 'updatedAt'];
    const csv = Papa.unparse(users, { fields });

    res.header('Content-Type', 'text/csv');
    res.attachment('users_export.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

// --- GET CURRENT USER ---
const getMe = async (req, res, next) => {
  try {
    const userId = Number(req.auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Invalid authentication data.' });

    const user = await userService.findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.status(200).json(toSnakeCaseUser(user));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  importUsers,
  exportUsers,
  getMe,
};
