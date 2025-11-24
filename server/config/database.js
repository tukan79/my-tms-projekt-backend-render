// server/config/database.js
const path = require('node:path');

// Ładujemy dotenv TYLKO lokalnie
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}

const commonConfig = {
  dialect: 'postgres',
  define: {
    underscored: true,
  },
};

module.exports = {
  development: {
    ...commonConfig,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'tms_dev',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
  },

  production: {
    ...commonConfig,
    use_env_variable: 'DATABASE_URL',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
