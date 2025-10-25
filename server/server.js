 // Plik server/server.js - Główny plik startowy serwera
 
 const app = require('./app');
 
 // Używamy bardziej specyficznej zmiennej, aby uniknąć konfliktów z globalnym `PORT`
 const PORT = process.env.API_PORT || 8080;
 
 app.listen(PORT, '0.0.0.0', () => {
   console.log(`🚀 Server is running on port ${PORT} and is accessible from your network.`);
 });