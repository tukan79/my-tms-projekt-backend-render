// Plik: server/middleware/validationMiddleware.js
const { body, validationResult } = require('express-validator');
const { isStrongPassword, passwordStrengthMessage } = require('../utils/validation.js');
const { User } = require('../models');

// Middleware do obsługi błędów walidacji
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Zwracamy tylko pierwszą wiadomość o błędzie dla uproszczenia
    const firstError = errors.array({ onlyFirstError: true })[0].msg;
    return res.status(400).json({ error: firstError });
  }
  next();
};

// Walidacja dla tworzenia i aktualizacji przejazdu (run)
exports.validateRun = [
  body('run_date')
    .isISO8601()
    .withMessage('A valid run date is required.'),
  body('type')
    .isIn(['collection', 'delivery', 'trunking'])
    .withMessage('A valid run type is required (collection, delivery, or trunking).'),
  body('driver_id')
    .isInt({ min: 1 })
    .withMessage('A valid driver ID is required.'),
  body('truck_id')
    .isInt({ min: 1 })
    .withMessage('A valid truck ID is required.'),
  // Dodajemy obsługę błędów na końcu łańcucha walidacji
  handleValidationErrors,
];

// Walidacja dla tworzenia użytkownika przez admina
exports.validateUserCreation = [
  body('email')
    .isEmail().withMessage('Please provide a valid email.')
    .normalizeEmail()
    .custom(async (value) => {
      const user = await User.findOne({ where: { email: value } });
      if (user) {
        return'E-mail already in use.';
      }
    }),
  body('first_name').notEmpty().withMessage('First name is required.').trim().escape(),
  body('last_name').notEmpty().withMessage('Last name is required.').trim().escape(),
  body('password').custom(value => {
    if (!isStrongPassword(value)) {
      throw new Error(passwordStrengthMessage);
    }
    return true;
  }),
  body('role')
    .isIn(['admin', 'dispatcher', 'user'])
    .withMessage('Invalid role specified.'),
  handleValidationErrors,
];

// Walidacja dla aktualizacji użytkownika przez admina
exports.validateUserUpdate = [
  body('email')
    .optional()
    .isEmail().withMessage('Please provide a valid email.')
    .normalizeEmail(),
  body('first_name').optional().notEmpty().withMessage('First name cannot be empty.').trim().escape(),
  body('last_name').optional().notEmpty().withMessage('Last name cannot be empty.').trim().escape(),
  body('password').optional().custom(value => {
    if (!isStrongPassword(value)) {
      throw new Error(passwordStrengthMessage);
    }
    return true;
  }),
  body('role').optional().isIn(['admin', 'dispatcher', 'user']).withMessage('Invalid role specified.'),
  handleValidationErrors,
];

// Walidacja dla tworzenia i aktualizacji zamówienia (order)
exports.validateOrder = [
  body('client_id')
    .isInt({ min: 1 })
    .withMessage('A valid client ID is required.'),
  body('pickup_postcode')
    .notEmpty()
    .withMessage('Pickup postcode is required.'),
  body('delivery_postcode')
    .notEmpty()
    .withMessage('Delivery postcode is required.'),
  body('status')
    .optional() // Status może nie być ustawiany przy tworzeniu
    .isIn(['new', 'assigned', 'in_transit', 'delivered', 'cancelled'])
    .withMessage('Invalid order status.'),
  body('pallets')
    .isArray()
    .withMessage('Pallets must be an array.'),
  // Dodajemy obsługę błędów na końcu łańcucha walidacji
  handleValidationErrors,
];