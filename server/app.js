// Plik server/app.js - Konfiguracja aplikacji Express
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser'); // Importujemy cookie-parser
const rateLimit = require('express-rate-limit');

const util = require('util'); // Importujemy moduł 'util'
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
const surchargeTypeRoutes = require('./routes/surchargeTypeRoutes.js');
const feedbackRoutes = require('./routes/feedbackRoutes.js');
const invoiceRoutes = require('./routes/invoiceRoutes.js');
// ... i tak dalej dla innych zasobów

// Importujemy middleware do obsługi błędów
const errorMiddleware = require('./middleware/errorMiddleware');
const db = require('./db');

const app = express();

// Middleware do parsowania ciasteczek musi być przed CORS, jeśli używasz credentials
app.use(cookieParser());

// --- Middleware bezpieczeństwa ---
app.use(helmet()); // Ustawia bezpieczne nagłówki HTTP

app.use(cors({
  origin: (origin, callback) => {
    // Pozwalamy na żądania bez 'origin' (np. z Postmana, cURL) oraz z dozwolonych adresów.
    // To ułatwia testowanie API.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Pozwala na przesyłanie danych uwierzytelniających (np. ciasteczek)
}));

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
if (process.env.NODE_ENV !== 'production') {
  morgan.token('body', (req) => util.inspect(req.body, { depth: 3, colors: false }));
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms :body'));
} else {
  app.use(morgan('combined')); // Standardowy format logów dla produkcji
}

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
app.use('/api/rate-cards', rateCardRoutes);
app.use('/api/surcharge-types', surchargeTypeRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/feedback', feedbackRoutes);

// --- Obsługa błędów ---
// Middleware do obsługi nieznalezionych tras (404)
app.use((req, res, next) => {
  res.status(404).json({ error: `Resource not found: ${req.originalUrl}` });
});

app.use(errorMiddleware); // Centralny middleware do obsługi błędów

module.exports = app;