const userService = require('../services/userService');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await userService.findAllUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
};

exports.exportUsers = async (req, res, next) => {
  try {
    const users = await userService.findAllUsers();
    // Funkcja findAllUsers już zwraca bezpieczne dane bez hasła
    const csv = Papa.unparse(users);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `users_${timestamp}.csv`;
    const exportsDir = path.join(__dirname, '../exports');

    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const filePath = path.join(exportsDir, filename);
    fs.writeFileSync(filePath, csv, 'utf8');

    res.status(200).json({ message: `File successfully exported to server as ${filename}` });
  } catch (error) {
    console.error('Failed to export users:', error);
    res.status(500).json({ error: 'An error occurred while exporting users.' });
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const newUser = await userService.createUser(req.body);
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const updatedUser = await userService.updateUser(req.params.userId, req.body);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const changes = await userService.deleteUser(req.params.userId);
    if (changes === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

exports.importUsers = async (req, res, next) => {
  try {
    if (!req.body || !Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Invalid data format. An array of users is required.' });
    }
    const result = await userService.importUsers(req.body);
    res.status(201).json({ message: `Successfully processed ${result.count} users.`, ...result });
  } catch (error) {
    next(error);
  }
};