// Plik server/middleware/errorMiddleware.js
const logger = require('../config/logger'); // Importujemy logger

/**
 * Centralny middleware do obsługi błędów.
 * Loguje błędy i wysyła spójną odpowiedź do klienta.
 */
module.exports = (error, req, res, next) => {
  // Logowanie błędu za pomocą loggera winston
  // Logujemy pełny obiekt błędu, aby mieć dostęp do stack trace i innych właściwości
  logger.error(`${error.status || 500} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, { error });

  // Obsługa specyficznego błędu naruszenia unikalności z bazy danych PostgreSQL (kod '23505')
  if (error.code === '23505') {
    // Parsujemy `error.detail`, aby uzyskać bardziej szczegółowy komunikat.
    const detail = error.detail || '';
    // Przykład `detail`: Key (email)=(admin@test.com) already exists.
    const match = detail.match(/\((.*?)\)=\((.*?)\)/);
    let errorMessage = 'Conflict: A provided value already exists.';
    if (match && match[1] && match[2]) {
      const field = match[1].replace(/_/g, ' '); // np. registration_plate -> registration plate
      errorMessage = `The ${field} '${match[2]}' is already in use. Please choose another one.`;
    }
    return res.status(409).json({ error: errorMessage }); // 409 Conflict
  }

  // Używamy statusu z obiektu błędu, jeśli jest dostępny, w przeciwnym razie domyślnie 500
  const statusCode = error.status || (error.message.includes('not found') ? 404 : 500);

  const response = {
    error: error.message || 'An internal server error occurred.',
  };

  // W środowisku deweloperskim wysyłamy więcej szczegółów
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  } else {
    // W środowisku produkcyjnym, dla błędów 500, wysyłamy tylko ogólny komunikat
    if (statusCode === 500) {
      response.error = 'An internal server error occurred.';
    }
  }
  res.status(statusCode).json(response);
};