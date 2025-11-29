// Plik: server/controllers/authController.js
const { body, validationResult } = require('express-validator');
const userService = require('../services/userService.js');
const authService = require('../services/authService.js');

const REFRESH_COOKIE_NAME = 'refreshToken';
const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Walidacja danych dla rejestracji
 */
const registerValidation = [
  body('email').isEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').notEmpty().withMessage('Role is required'),
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
];

/**
 * Walidacja danych dla logowania
 */
const loginValidation = [
  body('email').isEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

/**
 * Rejestracja nowego użytkownika
 */
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, role, first_name, last_name } = req.body;

    const existingUser = await userService.findUserByEmailWithPassword(email);
    if (existingUser) return res.status(409).json({ error: 'User with this email already exists' });

    const newUser = await userService.createUser({
      email,
      password,
      role,
      firstName: first_name,
      lastName: last_name,
    });

    // Generujemy tokeny
    const tokens = await authService.generateTokens(newUser);

    const { passwordHash, ...userData } = newUser.get({ plain: true });
    res
      .cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions)
      .status(201)
      .json({ user: userData, ...tokens });
  } catch (error) {
    next(error);
  }
};

/**
 * Logowanie użytkownika
 */
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await userService.loginUser(email, password);

    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const tokens = await authService.generateTokens(user);
    const { passwordHash, ...userData } = user.get({ plain: true });

    res
      .cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions)
      .status(200)
      .json({ user: userData, ...tokens });
  } catch (error) {
    next(error);
  }
};

/**
 * Wylogowanie użytkownika (unieważnienie refresh token)
 */
const logout = async (req, res, next) => {
  try {
    const refreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME] ||
      req.body.refreshToken ||
      req.headers['x-refresh-token'];
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token is required' });

    const user = await userService.findUserByRefreshToken(refreshToken);
    if (user) {
      await userService.updateUserRefreshToken(user.id, null); // usuń token z bazy
    }

    res
      .clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOptions, maxAge: undefined })
      .status(200)
      .json({ message: 'Successfully logged out' });
  } catch (error) {
    next(error);
  }
};

/**
 * Odświeżenie accessToken przy użyciu refreshToken
 */
const refreshToken = async (req, res, next) => {
  try {
    const oldRefreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME] ||
      req.body.refreshToken ||
      req.headers['x-refresh-token'];

    if (!oldRefreshToken) {
      return res.status(401).json({ error: 'Refresh token is required' });
    }

    const user = await userService.findUserByRefreshToken(oldRefreshToken);
    if (!user) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const tokens = await authService.rotateTokens(user);
    res
      .cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions)
      .status(200)
      .json(tokens);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    next(error);
  }
};

/**
 * Pobranie danych aktualnie zalogowanego użytkownika
 */
const getMe = async (req, res, next) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: 'Authentication data not found' });

    const user = await userService.findUserById(req.auth.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { passwordHash, ...userData } = user.get({ plain: true });
    res.status(200).json(userData);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerValidation,
  loginValidation,
  register,
  login,
  logout,
  refreshToken,
  getMe,
};
