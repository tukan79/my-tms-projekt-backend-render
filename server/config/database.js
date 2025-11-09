// Plik server/config/database.js
const path = require('path');

// Ładujemy zmienne środowiskowe z pliku .env w katalogu server
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const commonConfig = {
  dialect: 'postgres',
  // Użyj `snake_case` dla wszystkich automatycznie generowanych nazw (np. kluczy obcych)
  // To zapewni spójność z nazewnictwem w Twoim pliku init.js
  define: {
    underscored: true,
  },
};

module.exports = {
  development: {
    ...commonConfig,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
  },
  production: {
    ...commonConfig,
    use_env_variable: 'DATABASE_URL', // Sequelize-CLI automatycznie użyje tej zmiennej
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
