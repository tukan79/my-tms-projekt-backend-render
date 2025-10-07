const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken, requireRole(['admin']));

router.get('/', userController.getAllUsers);
router.get('/export', userController.exportUsers);
router.post('/', userController.createUser);
router.post('/import', userController.importUsers);
router.put('/:userId', userController.updateUser);
router.delete('/:userId', userController.deleteUser);

module.exports = router;