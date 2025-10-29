// Plik: server/controllers/userController.js
const userService = require('../services/userService.js');
const Papa = require('papaparse');

const getAllUsers = async (req, res, next) => {
  try {
    const users = await userService.findAllUsers();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    // Mapujemy snake_case z req.body na camelCase dla serwisu
    const newUser = await userService.createUser({
      email: req.body.email,
      password: req.body.password,
      firstName: req.body.first_name,
      lastName: req.body.last_name,
    });
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    // Mapujemy snake_case z req.body na camelCase dla serwisu
    const updatedUser = await userService.updateUser(userId, {
      firstName: req.body.first_name,
      lastName: req.body.last_name,
      role: req.body.role,
      password: req.body.password,
    });
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const deletedCount = await userService.deleteUser(userId);
    if (deletedCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(204).send(); // 204 No Content - standardowa odpowiedź dla udanego usunięcia
  } catch (error) {
    next(error);
  }
};

const importUsers = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const csvData = req.file.buffer.toString('utf-8');
    const parsedData = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsedData.errors.length > 0) {
      return res.status(400).json({ 
        error: 'Error parsing CSV file.', 
        details: parsedData.errors 
      });
    }

    const result = await userService.importUsers(parsedData.data);

    res.status(201).json({
      message: `Successfully processed file. Imported or updated ${result.count} users.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const exportUsers = async (req, res, next) => {
  try {
    const users = (await userService.findAllUsers()).map(u => u.get({ plain: true })); // Pobieramy czyste obiekty
    const fields = ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt', 'updatedAt'];
    const csv = Papa.unparse(users, { fields });

    res.header('Content-Type', 'text/csv');
    res.attachment('users_export.csv');
    res.send(csv);
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
};