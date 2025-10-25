 // Plik server/server.js - Główny plik startowy serwera
 const app = require('./app');
 
 // Używamy bardziej specyficznej zmiennej, aby uniknąć konfliktów z globalnym `PORT`
 // Na platformach takich jak Render, aplikacja musi nasłuchiwać na porcie zdefiniowanym w zmiennej środowiskowej `PORT`.
 // Używamy `process.env.PORT` dla zgodności z produkcją, a `process.env.API_PORT` jako fallback dla lokalnego rozwoju.
 const PORT = process.env.PORT || process.env.API_PORT || 3000;
 
 app.listen(PORT, '0.0.0.0', () => {
   console.log(`🚀 Server is running on port ${PORT} and is accessible from your network.`);
 });