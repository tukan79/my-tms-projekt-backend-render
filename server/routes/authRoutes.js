// Plik server/routes/authRoutes.js
const express = require('express');
const { rateLimit } = require('express-rate-limit'); // Zmiana na import destrukturyzowany
const authController = require('../controllers/authController.js');
const authMiddleware = require('../middleware/authMiddleware.js');

// Dedykowany limiter dla tras logowania i rejestracji, aby chronić przed atakami brute-force
// Dedicated limiter for login and registration routes to protect against brute-force attacks
const router = express.Router();

// Używamy prawdziwego limitera tylko w produkcji. W dev używamy "pustego" middleware.
const authLimiter = process.env.NODE_ENV === 'production'
  ? rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minut
      max: 20, // Limit dla produkcji
      message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
      standardHeaders: true,
      legacyHeaders: false,
    })
  : (req, res, next) => next(); // Brak limitu w środowisku deweloperskim

// Rejestracja nowego użytkownika
// Register a new user
router.post('/register', authLimiter, authController.registerValidation, authController.register);
router.post('/login', authLimiter, authController.loginValidation, authController.login);

// Dodajemy trasę do wylogowania
router.post('/logout', authController.logout);

// Trasa do odświeżania tokenu
router.post('/refresh', authController.refreshToken);

// Endpoint do pobierania danych zalogowanego użytkownika na podstawie tokenu
// Endpoint to get the current user's data based on the token
router.get('/me', authMiddleware.authenticateToken, authController.getMe);

// Trasa statusu serwera (można przenieść do innego pliku, np. systemRoutes.js)
// Server status route (can be moved to another file, e.g., systemRoutes.js)
router.get('/status', (req, res) => res.status(200).json({ message: 'TMS Server is running correctly! 🚀' }));

module.exports = router;
