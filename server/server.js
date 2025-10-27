// Plik server/server.js - Główny plik startowy serwera
// Warunkowo ładujemy dotenv tylko w środowisku deweloperskim.
// Na produkcji (np. na Render) zmienne są dostarczane bezpośrednio.

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = require('./app.js');
const db = require('./db/index.js'); // Importujemy instancję bazy danych

// Używamy bardziej specyficznej zmiennej, aby uniknąć konfliktów z globalnym `PORT`
// Na platformach takich jak Render, aplikacja musi nasłuchiwać na porcie zdefiniowanym w zmiennej środowiskowej `PORT`.
// Używamy `process.env.PORT` dla zgodności z produkcją, a `process.env.API_PORT` jako fallback dla lokalnego rozwoju.
const PORT = process.env.PORT || process.env.API_PORT || 3000;

let server;

const startServer = async () => {
  try {
    // Krok 1: Sprawdź połączenie z bazą danych przed uruchomieniem serwera
    console.log('🔵 Verifying database connection...');
    await db.testConnection();
    console.log('✅ Database connection verified.');

    // Krok 2: Uruchom serwer Express
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on port ${PORT} and is accessible from your network.`);
    });

    // Ulepszona obsługa błędów serwera
    server.on('error', (error) => {
      if (error.syscall !== 'listen') throw error;
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Error: Port ${PORT} is already in use.`);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('🔥 Failed to start server due to database connection error:', error.message);
    process.exit(1);
  }
};

startServer();

// --- Graceful Shutdown ---
// Obsługa sygnału SIGTERM, który jest wysyłany przez platformy takie jak Render podczas wdrożeń.
const gracefulShutdown = () => {
  console.log('🟡 SIGTERM signal received: closing HTTP server.');
  server.close(() => {
    console.log('✅ HTTP server closed.');
    db.pool.end(() => {
      console.log('🐘 PostgreSQL pool has been closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);