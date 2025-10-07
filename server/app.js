// Plik server/app.js - Konfiguracja aplikacji Express
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Importujemy trasy
const authRoutes = require('./routes/authRoutes');
const driverRoutes = require('./routes/driverRoutes');
const userRoutes = require('./routes/userRoutes');
const truckRoutes = require('./routes/truckRoutes');
const trailerRoutes = require('./routes/trailerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const runRoutes = require('./routes/runRoutes');
const customerRoutes = require('./routes/customerRoutes.js');
const postcodeZoneRoutes = require('./routes/postcodeZoneRoutes');
const rateCardRoutes = require('./routes/rateCardRoutes');
// ... i tak dalej dla innych zasobów

// Importujemy middleware do obsługi błędów
const errorMiddleware = require('./middleware/errorMiddleware');
const db = require('./db');

const app = express();

// --- Middleware bezpieczeństwa ---
app.use(helmet()); // Ustawia bezpieczne nagłówki HTTP

const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
};
app.use(cors(corsOptions));   // Umożliwia żądania z innych domen (konfigurowalne)

// Ogranicznik żądań, aby chronić przed atakami brute-force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  // Zwiększamy limit w środowisku deweloperskim, aby uniknąć problemów z podwójnym renderowaniem w React.
  // Increase the limit in the development environment to avoid issues with React's double rendering.
  max: process.env.NODE_ENV === 'production' ? 100 : 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter); // Stosuj do wszystkich tras API

// --- Middleware do kontroli cache ---
// Wyłączamy cache dla wszystkich tras API, aby zapewnić, że klient zawsze otrzymuje świeże dane.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Globalne middleware
app.use(express.json({ limit: '5mb' })); // Zwiększamy limit do 5MB, aby umożliwić import większych plików CSV.

// Zaawansowane logowanie z morgan, które zawiera również ciało żądania
morgan.token('body', (req) => JSON.stringify(req.body));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms :body'));

// --- Health Check Endpoint ---
app.get('/health', async (req, res) => {
  try {
    // Proste zapytanie do bazy danych, aby sprawdzić, czy połączenie działa.
    await db.query('SELECT 1');
    res.status(200).json({
      status: 'OK',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// Montowanie tras
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trucks', truckRoutes);
app.use('/api/trailers', trailerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/zones', postcodeZoneRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rate-cards', rateCardRoutes);

// --- Obsługa błędów ---
// Middleware do obsługi nieznalezionych tras (404)
app.use((req, res, next) => {
  res.status(404).json({ error: `Nie znaleziono zasobu: ${req.originalUrl}` });
});

app.use(errorMiddleware); // Centralny middleware do obsługi błędów

module.exports = app;