// Plik server/db/index.js
const { Pool } = require('pg');
// Nie ma potrzeby wczytywać dotenv tutaj, ponieważ jest już załadowany w głównym pliku server.js

let pool;

const getPool = () => {
  if (!pool) {
    console.log('🟡 Tworzenie nowej puli połączeń PostgreSQL...');
    // Pula jest tworzona dopiero przy pierwszym wywołaniu.
    // Jeśli zmienne środowiskowe są niepoprawne, błąd zostanie rzucony tutaj
    // i złapany przez blok try...catch w `startServer`.
    pool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || null,
    });

    // Dodajemy nasłuchiwanie na błędy w puli (np. błąd połączenia)
    pool.on('error', (err, client) => {
      console.error('🔴 Nieoczekiwany błąd na kliencie puli PostgreSQL', err);
    });
  }
  return pool;
};

module.exports = {
  // `query` to metoda do wykonywania zapytań do bazy danych
  query: (text, params) => getPool().query(text, params),
  // Możemy również wyeksportować samą pulę, jeśli potrzebne są bardziej zaawansowane operacje, np. transakcje
  getPool,
  // Dodajemy metodę do zamykania puli połączeń, przydatną przy zamykaniu serwera
  end: () => {
    if (pool) {
      console.log('🔵 Zamykanie puli połączeń PostgreSQL.');
      return pool.end();
    }
  },
  /**
   * Wykonuje operacje w ramach transakcji bazodanowej.
   * @param {Function} callback - Funkcja, która otrzymuje klienta transakcji jako argument.
   * @returns {Promise<any>} Wynik działania funkcji callback.
   */
  withTransaction: async (callback) => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      // Rzucamy błąd dalej, aby mógł być obsłużony przez wyższą warstwę
      throw error;
    } finally {
      // Zawsze zwalniamy klienta z powrotem do puli
      client.release();
    }
  },
};