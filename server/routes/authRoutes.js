// Plik server/routes/authRoutes.js
const express = require('express');
const { rateLimit } = require('express-rate-limit'); // Zmiana na import destrukturyzowany
const authController = require('../controllers/authController.js');
const { authenticateToken } = require('../middleware/authMiddleware.js');

// Dedykowany limiter dla tras logowania i rejestracji, aby chronić przed atakami brute-force
// Dedicated limiter for login and registration routes to protect against brute-force attacks
const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  // Zwiększamy limit w środowisku deweloperskim.
  // Increase the limit in the development environment.
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rejestracja nowego użytkownika
// Register a new user
router.post('/register', authLimiter, authController.registerValidation, authController.register);
router.post('/login', authLimiter, authController.loginValidation, authController.login);

// Dodajemy trasę do wylogowania
router.post('/logout', authController.logout);

// Dodajemy brakującą trasę do weryfikacji tokenu
// Adding the missing route for token verification
router.get('/verify', authenticateToken, authController.verifyToken);

// Trasa statusu serwera (można przenieść do innego pliku, np. systemRoutes.js)
// Server status route (can be moved to another file, e.g., systemRoutes.js)
router.get('/status', (req, res) => res.status(200).json({ message: 'TMS Server is running correctly! 🚀' }));

module.exports = router;