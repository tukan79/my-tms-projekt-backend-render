// server/services/authService.js
const jwt = require('jsonwebtoken');
const userService = require('./userService.js');

/**
 * Waliduje podstawowe pola obiektu użytkownika
 * @param {object} user 
 */
function validateUserObject(user) {
  if (!user || !user.id || !user.email || !user.role) {
    throw new Error('Invalid user object provided to authService');
  }
}

/**
 * Generuje parę tokenów: accessToken i refreshToken.
 * @param {object} user - Obiekt użytkownika z polami: id, email, role
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
const generateTokens = async (user) => {
  try {
    validateUserObject(user);

    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      throw new Error('Server configuration error: JWT secrets are missing.');
    }

    const payload = { userId: user.id, email: user.email, role: user.role };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    await userService.updateUserRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Error generating tokens:', error);
    throw error;
  }
};

/**
 * Generuje nowy accessToken na podstawie istniejącego obiektu użytkownika
 * @param {object} user - Obiekt użytkownika
 * @returns {string} Nowy accessToken
 */
const refreshAccessToken = (user) => {
  try {
    validateUserObject(user);

    if (!process.env.JWT_SECRET) {
      throw new Error('Server configuration error: JWT_SECRET is missing.');
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
};

/**
 * Rotuje tokeny: generuje nowy accessToken i refreshToken, 
 * zapisując nowy refreshToken w bazie danych i unieważniając stary.
 * @param {object} user - Obiekt użytkownika
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
const rotateTokens = async (user) => {
  try {
    validateUserObject(user);

    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      throw new Error('Server configuration error: JWT secrets are missing.');
    }

    const payload = { userId: user.id, email: user.email, role: user.role };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    await userService.updateUserRefreshToken(user.id, newRefreshToken);

    return { accessToken, refreshToken: newRefreshToken };
  } catch (error) {
    console.error('Error rotating tokens:', error);
    throw error;
  }
};

module.exports = {
  generateTokens,
  refreshAccessToken,
  rotateTokens,
};
