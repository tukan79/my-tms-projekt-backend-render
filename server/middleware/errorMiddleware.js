// Plik server/middleware/errorMiddleware.js
const logger = require('../config/logger'); // Importujemy logger

/**
 * Centralny middleware do obsługi błędów.
 * Loguje błędy i wysyła spójną odpowiedź do klienta.
 */
const errorMiddleware = (error, req, res, next) => {
  logger.error(
    `${error?.status || 500} - ${error?.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`,
    { error }
  );

  if (error?.code === '23505') {
    const detail = error.detail || '';
    const match = detail.match(/\((.*?)\)=\((.*?)\)/);
    let errorMessage = 'Conflict: A provided value already exists.';
    if (match?.[1] && match?.[2]) {
      const field = match[1].replaceAll('_', ' '); // np. registration_plate -> registration plate
      errorMessage = `The ${field} '${match[2]}' is already in use. Please choose another one.`;
    }
    return res.status(409).json({ error: errorMessage });
  }

  const statusCode = error.status || (error.message?.includes('not found') ? 404 : 500);

  const response = {
    error: error.message || 'An internal server error occurred.',
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  } else if (statusCode === 500) {
    response.error = 'An internal server error occurred.';
  }

  res.status(statusCode).json(response);
};

module.exports = errorMiddleware;
