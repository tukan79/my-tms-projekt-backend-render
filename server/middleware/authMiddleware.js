// Plik server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
      // Używamy 401 Unauthorized, gdy brakuje danych uwierzytelniających
      return res.status(401).json({ error: 'Brak tokenu uwierzytelniającego.' });
    }

    // Sprawdzenie, czy sekret JWT jest załadowany
    if (!process.env.JWT_SECRET) {
      console.error('Błąd serwera: Brak zdefiniowanego JWT_SECRET w zmiennych środowiskowych.');
      return res.status(500).json({ error: 'Błąd konfiguracji serwera.' });
    }

    // Używamy synchronicznej wersji verify w bloku try...catch dla spójnej obsługi błędów
    const auth = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = auth; // np. { userId: 1, email: '...', role: 'admin' }
    next();
  } catch (error) {
    // Tworzymy nowy błąd ze statusem 403 i przekazujemy go dalej
    const authError = new Error('Nieprawidłowy lub nieważny token.');
    authError.status = 403;
    // Przekazujemy błąd do centralnego error handlera
    return next(authError);
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
      const authError = new Error('Brak wystarczających uprawnień do wykonania tej operacji.');
      authError.status = 403;
      return next(authError);
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
};