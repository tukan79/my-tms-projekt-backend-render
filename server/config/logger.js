// Plik: server/config/logger.js
const winston = require('winston');

const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize } = format;

const logFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  // Jeśli istnieją dodatkowe metadane (np. obiekt błędu), dołącz je jako JSON.
  const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  // Jeśli istnieje stack trace, użyj go; w przeciwnym razie użyj samej wiadomości.
  const logMessage = stack || message;

  return `${ts} ${level}: ${logMessage} ${metaString}`;
});

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }), // Log the stack trace
    logFormat
  ),
  transports: [
    // W trybie deweloperskim logujemy do konsoli z kolorami
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
  ],
});

module.exports = logger;