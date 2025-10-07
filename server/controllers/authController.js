// Plik server/controllers/authController.js
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userService = require('../services/userService.js');

exports.register = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Lepsza walidacja danych wejściowych.
    // Better input validation.
    if (!email || !password || !validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email or missing password.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const newUser = await userService.createUser({ email, password });

    // Nie zwracamy całego obiektu, tylko potwierdzenie.
    // We don't return the whole object, just a confirmation.
    res.status(201).json({ message: 'User registered successfully.', user: { id: newUser.id, email: newUser.email, role: newUser.role } });
  } catch (error) {
    return next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await userService.findUserByEmailWithPassword(email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
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
    res.json({ token, user: userPayload });
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
    res.json({ user });
  } catch (error) {
    return next(error);
  }
};