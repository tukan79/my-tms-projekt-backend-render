// Plik server/controllers/authController.js
const validator = require('validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { isStrongPassword, passwordStrengthMessage } = require('../utils/validation.js');
const authService = require('../services/authService.js'); // Importujemy nowy serwis
const userService = require('../services/userService.js'); // Pozostawiamy dla operacji na użytkownikach

const registerValidation = [
  body('email').isEmail().withMessage('Please provide a valid email.').normalizeEmail(),
  body('firstName').not().isEmpty().withMessage('First name is required.').trim().escape(),
  body('lastName').not().isEmpty().withMessage('Last name is required.').trim().escape(),
  body('password').custom(value => {
    if (!isStrongPassword(value)) {
      throw new Error(passwordStrengthMessage);
    }
    return true;
  })
];

const register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { email, password, firstName, lastName } = req.body;

    // Poprawka: Jawnie ustawiamy rolę na 'user' podczas rejestracji.
    const newUser = await userService.createUser({
      email: email,
      password,
      firstName: firstName,
      lastName: lastName,
      role: 'user',
    });

    // Nie zwracamy całego obiektu, tylko potwierdzenie.
    // We don't return the whole object, just a confirmation.
    return res.status(201).json({ message: 'User registered successfully.', user: { id: newUser.id, email: newUser.email, role: newUser.role } });
  } catch (error) {
    return next(error);
  }
};

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email.').normalizeEmail(),
  body('password').not().isEmpty().withMessage('Password cannot be empty.')
];

const login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { email, password } = req.body;

    const user = await userService.loginUser(email, password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const { accessToken, refreshToken } = await authService.generateTokens(user);

    // Krok 4: Wyślij refreshToken w bezpiecznym ciasteczku httpOnly
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Używaj `secure` tylko na produkcji (HTTPS)
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dni
    });

    // W odpowiedzi do klienta możemy zwrócić więcej danych.
    // We can return more data in the response to the client.
    const userPayload = { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    };
    // Zwróć accessToken i dane użytkownika
    return res.json({ accessToken, user: userPayload });
  } catch (error) {
    return next(error);
  }
};

const verifyToken = async (req, res, next) => {
  try {
    // Jeśli middleware authenticateToken przeszedł, token jest ważny.
    // If the authenticateToken middleware has passed, the token is valid.
    // Pobieramy pełne dane użytkownika z bazy danych, aby zapewnić spójność z danymi po logowaniu.
    // We fetch the full user data from the database to ensure consistency with the data after login.
    const user = await userService.findUserById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const userPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    return res.json({ user: userPayload });
  } catch (error) {
    return next(error);
  }
};

// Nowa funkcja do odświeżania tokenu
const refreshToken = async (req, res, next) => {
  const tokenFromCookie = req.cookies.refreshToken;
  if (!tokenFromCookie) {
    return res.status(401).json({ error: 'Refresh token not found.' });
  }

  try {
    const user = await userService.findUserByRefreshToken(tokenFromCookie);
    if (!user) {
      return res.status(403).json({ error: 'Invalid refresh token.' });
    }

    // Weryfikacja tokenu
    jwt.verify(tokenFromCookie, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
      if (err || user.id !== decoded.userId) {
        return res.status(403).json({ error: 'Invalid refresh token.' });
      }

      // Jeśli wszystko jest w porządku, wygeneruj nowy accessToken
      const accessToken = authService.refreshAccessToken(user);

      res.json({ accessToken });
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const tokenFromCookie = req.cookies.refreshToken;
    if (tokenFromCookie) {
      const user = await userService.findUserByRefreshToken(tokenFromCookie);
      if (user) {
        // Wyczyść refreshToken w bazie danych
        await userService.updateUserRefreshToken(user.id, null);
      }
    }
    // Wyczyść ciasteczko po stronie klienta
    res.clearCookie('refreshToken');
    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerValidation,
  register,
  loginValidation,
  login,
  verifyToken,
  logout,
  refreshToken,
};