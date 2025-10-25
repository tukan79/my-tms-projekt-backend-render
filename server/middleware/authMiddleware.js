// Plik server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // Token z cookie lub nagłówka Authorization: Bearer <token>
  const header = req.headers.authorization;
  const headerToken = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  const cookieToken = req.cookies?.token;
  const token = headerToken || cookieToken; // Pozostawiamy cookieToken dla ewentualnej przyszłej kompatybilności

  if (!token) {
    return res.status(401).json({ error: 'Authentication token is missing.' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('Server Error: JWT_SECRET is not defined.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }
  try {
    const auth = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = auth; // np. { userId: 1, email: '...', role: 'admin' }
    return next();
  } catch (err) {
    // Błąd weryfikacji tokenu (np. wygasł)
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

/**
 * Middleware do sprawdzania, czy użytkownik ma jedną z wymaganych ról.
 * @param {string[]} roles - Tablica dozwolonych ról (np. ['admin', 'dispatcher']).
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    // Zakładamy, że authenticateToken zostało już użyte i req.auth istnieje.
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to perform this operation.' });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
};