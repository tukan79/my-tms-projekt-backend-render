 // Plik server/server.js - Główny plik startowy serwera
 const dotenv = require('dotenv');
 
 // Ładujemy zmienne środowiskowe z pliku .env na samym początku
 dotenv.config();
 
 const app = require('./app');
 
 // Używamy bardziej specyficznej zmiennej, aby uniknąć konfliktów z globalnym `PORT`
 const PORT = process.env.API_PORT || 3000;
 
 app.listen(PORT, () => {
   console.log(`🚀 Server is running on port ${PORT}`);
 });