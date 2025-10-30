// Plik: server/services/authService.js
const jwt = require('jsonwebtoken');
const userService = require('./userService.js');

/**
 * Generuje parę tokenów: accessToken i refreshToken.
 * @param {object} user - Obiekt użytkownika z danymi do payloadu.
 * @returns {{accessToken: string, refreshToken: string}}
 */
const generateTokens = async (user) => {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.error('JWT_SECRET or JWT_REFRESH_SECRET is not set');
    throw new Error('Server configuration error: JWT secrets are missing.');
  }

  const tokenPayload = { userId: user.id, email: user.email, role: user.role };

  // Stwórz accessToken (krótki czas życia)
  const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '15m' });

  // Stwórz refreshToken (długi czas życia)
  const refreshToken = jwt.sign(tokenPayload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

  // Zapisz refreshToken w bazie danych
  await userService.updateUserRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken };
};

/**
 * Generuje nowy accessToken na podstawie ważnego refreshToken.
 * @param {object} user - Obiekt użytkownika.
 * @returns {string} Nowy accessToken.
 */
const refreshAccessToken = (user) => {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set');
    throw new Error('Server configuration error: JWT_SECRET is missing.');
  }
  const tokenPayload = { userId: user.id, email: user.email, role: user.role };
  return jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '15m' });
};

module.exports = {
  generateTokens,
  refreshAccessToken,
};