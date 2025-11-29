// Plik: server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers?.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(401).json({ error: 'Brak tokenu uwierzytelniającego.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, authData) => {
    if (err) {
      const origin = req.headers.origin;
      if (origin) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", "true");
      }
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token wygasł.' }); // Używamy 401 dla wygaśnięcia
      }
      return res.status(403).json({ error: 'Token jest nieprawidłowy.' });
    }

    req.auth = authData;
    next();
  });
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.auth?.role) {
      return res.status(403).json({ error: 'Brak informacji o roli użytkownika.' });
    }

    const userRole = req.auth?.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        error: `Brak uprawnień. Wymagana rola: ${roles.join(' lub ')}.`,
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
};
