// Plik server/controllers/authController.js
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userService = require('../services/userService.js');

exports.register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();

    // Lepsza walidacja danych wejściowych.
    if (!normalizedEmail || !password || !validator.isEmail(normalizedEmail) || !firstName || !lastName) {
      return res.status(400).json({ error: 'Invalid email or missing password.' });
    }

    // Wzmocniona polityka haseł
    const passwordOptions = {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    };
    if (!validator.isStrongPassword(password, passwordOptions)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.' });
    }

    // Poprawka: Jawnie ustawiamy rolę na 'user' podczas rejestracji.
    const newUser = await userService.createUser({
      email: normalizedEmail,
      password,
      first_name: firstName,
      last_name: lastName,
      role: 'user',
    });

    // Nie zwracamy całego obiektu, tylko potwierdzenie.
    // We don't return the whole object, just a confirmation.
    return res.status(201).json({ message: 'User registered successfully.', user: { id: newUser.id, email: newUser.email, role: newUser.role } });
  } catch (error) {
    return next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await userService.findUserByEmailWithPassword(normalizedEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    // Tworzenie i zwracanie tokenu JWT.
    // Creating and returning a JWT token.
    // Do tokenu JWT wkładamy tylko to, co niezbędne do autoryzacji (ID, rola).
    // We only put what is necessary for authorization into the JWT token (ID, role).
    const tokenPayload = { userId: user.id, email: user.email, role: user.role, company_id: user.company_id };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1d' });

    // W odpowiedzi do klienta możemy zwrócić więcej danych.
    // We can return more data in the response to the client.
    const userPayload = { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name
    };
    // Wracamy do wysyłania tokenu w ciele odpowiedzi
    return res.json({ token, user: userPayload });
  } catch (error) {
    return next(error);
  }
};

exports.verifyToken = async (req, res, next) => {
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
      first_name: user.first_name,
      last_name: user.last_name,
    };
    return res.json({ user: userPayload });
  } catch (error) {
    return next(error);
  }
};

// Opcjonalnie: wylogowanie
exports.logout = (req, res) => {
  // Wylogowanie po stronie klienta polega na usunięciu tokenu z localStorage
  return res.json({ message: 'Logged out.' });
};