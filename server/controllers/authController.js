// server/controllers/authController.js
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { isStrongPassword, passwordStrengthMessage } = require('../utils/validation.js');
const authService = require('../services/authService.js');
const userService = require('../services/userService.js');

// --- Walidacja rejestracji ---
const registerValidation = [
  body('email').isEmail().withMessage('Proszę podać poprawny adres email.').normalizeEmail(),
  body('firstName').not().isEmpty().withMessage('Imię jest wymagane.').trim().escape(),
  body('lastName').not().isEmpty().withMessage('Nazwisko jest wymagane.').trim().escape(),
  body('password').custom(value => {
    if (!isStrongPassword(value)) {
      throw new Error(passwordStrengthMessage);
    }
    return true;
  }),
];

// --- Rejestracja użytkownika ---
const register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Zwracamy tylko pierwszy błąd dla uproszczenia
    return res.status(400).json({ error: errors.array({ onlyFirstError: true })[0].msg });
  }

  try {
    const { email, password, firstName, lastName } = req.body;
    // Używamy userService do stworzenia użytkownika, co jest zgodne z architekturą
    const newUser = await userService.createUser({
      email,
      password,
      firstName,
      lastName,
      role: 'user', // jawnie ustawiamy rolę
    });

    // Zwracamy tylko niezbędne, bezpieczne dane
    const userPayload = {
      email: newUser.email,
      role: newUser.role,
    };

    return res.status(201).json({
      message: 'Użytkownik został pomyślnie zarejestrowany.',
      user: userPayload, // Zwracamy okrojone dane użytkownika
    });
  } catch (error) {
    next(error);
  }
};

// --- Walidacja logowania ---
const loginValidation = [
  body('email').isEmail().withMessage('Proszę podać poprawny adres email.').normalizeEmail(),
  body('password').not().isEmpty().withMessage('Hasło nie może być puste.'),
];

// --- Logowanie użytkownika ---
const login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array({ onlyFirstError: true })[0].msg });
  }

  try {
    const { email, password } = req.body;
    const user = await userService.loginUser(email, password);

    if (!user) {
      return res.status(401).json({ error: 'Nieprawidłowe dane logowania.' });
    }

    const { accessToken, refreshToken } = await authService.generateTokens(user);

    // Zapisz refreshToken w httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // tylko HTTPS w produkcji
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dni
    });

    const userPayload = {
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    return res.json({ accessToken, user: userPayload });
  } catch (error) {
    next(error);
  }
};

// --- Weryfikacja access tokenu ---
const verifyToken = async (req, res, next) => {
  try {
    const user = await userService.findUserById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ error: 'Nie znaleziono użytkownika.' });
    }

    const userPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    return res.json({ valid: true, user: userPayload });
  } catch (error) {
    next(error);
  }
};

// --- Odświeżanie tokenu (refresh token flow) ---
const refreshToken = async (req, res, next) => {
  const tokenFromCookie = req.cookies.refreshToken;
  if (!tokenFromCookie) {
    return res.status(401).json({ error: 'Nie znaleziono tokenu odświeżającego.' });
  }

  try {
    console.log('🔁 Refresh request received. Cookie present:', !!tokenFromCookie);

    const user = await userService.findUserByRefreshToken(tokenFromCookie);
    if (!user) {
      return res.status(403).json({ error: 'Nieprawidłowy token odświeżający.' });
    }

    const decoded = jwt.verify(tokenFromCookie, process.env.JWT_REFRESH_SECRET);
    if (user.id !== decoded.userId) {
      return res.status(403).json({ error: 'Niezgodność tokenu odświeżającego.' });
    }

    // Generujemy nowy accessToken
    const accessToken = await authService.refreshAccessToken(user);

    return res.json({ accessToken });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(403).json({ error: 'Token odświeżający wygasł. Proszę zalogować się ponownie.' });
    }
    next(error);
  }
};

// --- Wylogowanie użytkownika ---
const logout = async (req, res, next) => {
  try {
    const tokenFromCookie = req.cookies.refreshToken;
    if (tokenFromCookie) {
      const user = await userService.findUserByRefreshToken(tokenFromCookie);
      // Unieważniamy token w bazie danych
      if (user) {
        await userService.updateUserRefreshToken(user.id, null);
      }
    }

    // Usuwamy cookie po stronie klienta
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });

    return res.status(200).json({ message: 'Wylogowano pomyślnie.' });
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
