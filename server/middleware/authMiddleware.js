// Plik: server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Dodajemy nagłówki CORS, aby uniknąć błędu blokady przez przeglądarkę
    // przy odpowiedzi 401. Lepszą praktyką jest globalna obsługa CORS,
    // ale to jest szybkie rozwiązanie problemu.
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(401).json({ error: 'Brak tokenu uwierzytelniającego.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, authData) => {
    if (err) {
      // Podobnie tutaj, dodajemy nagłówki dla odpowiedzi 403.
      res.header("Access-Control-Allow-Origin", "*");
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
    if (!req.auth || !req.auth.role) {
      return res.status(403).json({ error: 'Brak informacji o roli użytkownika.' });
    }

    const userRole = req.auth.role;
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