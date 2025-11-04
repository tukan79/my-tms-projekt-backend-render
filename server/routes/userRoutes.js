const express = require('express');
const userController = require('../controllers/userController.js');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware.js');
const { validateUserCreation, validateUserUpdate } = require('../middleware/validationMiddleware.js');

const router = express.Router();

// Endpoint dostępny dla każdego zalogowanego użytkownika
router.get('/me', authenticateToken, userController.getMe);

router.use(authenticateToken, requireRole(['admin']));

router.get('/', userController.getAllUsers);
router.get('/export', userController.exportUsers);
router.post('/', validateUserCreation, userController.createUser);
router.post('/import', userController.importUsers);
router.put('/:userId', validateUserUpdate, userController.updateUser);
router.delete('/:userId', userController.deleteUser);

module.exports = router;