// server/server.js

// Ładujemy dotenv w dev
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// DIAGNOSTYKA
console.log('🔑 Checking environment variables:');
console.log('   JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('   JWT_SECRET value:', process.env.JWT_SECRET ? '***SET***' : 'NOT SET');
console.log(
  '   All env vars:',
  Object.keys(process.env).filter((key) => key.includes('JWT'))
);

// IMPORTY
const express = require('express');
const cors = require('cors');
const app = require('./app.js');
const { sequelize } = require('./models');
const userService = require('./services/userService.js');

// PORT
const PORT = process.env.PORT || 10000;

// ---------------------------------------------
//  START SERWERA
// ---------------------------------------------
let server;

const startServer = async () => {
  try {
    console.log('🔵 Verifying database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');

    await userService.createDefaultAdminUser();

    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} already in use.`);
        process.exit(1);
      }
      throw error;
    });
  } catch (error) {
    console.error('🔥 Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

// ---------------------------------------------
//  GRACEFUL SHUTDOWN
// ---------------------------------------------
const gracefulShutdown = () => {
  console.log('🟡 SIGTERM received: closing server...');
  server.close(() => {
    console.log('✅ HTTP server closed.');
    sequelize.close().then(() => {
      console.log('🐘 DB connection closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
