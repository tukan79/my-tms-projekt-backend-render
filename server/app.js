// Plik server/app.js - Konfiguracja aplikacji Express
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const hpp = require('hpp');
// const csurf = require('csurf'); // Tymczasowo wyłączone, wymaga express-session lub innej konfiguracji
const logger = require('./config/logger.js'); // Importujemy nasz nowy logger

// Importujemy trasy
const authRoutes = require('./routes/authRoutes.js');
const driverRoutes = require('./routes/driverRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const truckRoutes = require('./routes/truckRoutes.js');
const trailerRoutes = require('./routes/trailerRoutes.js');
const orderRoutes = require('./routes/orderRoutes.js');
const assignmentRoutes = require('./routes/assignmentRoutes.js');
const runRoutes = require('./routes/runRoutes.js');
const customerRoutes = require('./routes/customerRoutes.js');
const postcodeZoneRoutes = require('./routes/postcodeZoneRoutes.js');
const rateCardRoutes = require('./routes/rateCardRoutes.js');
const surchargeTypeRoutes = require('./routes/surchargeTypeRoutes.js');
const feedbackRoutes = require('./routes/feedbackRoutes.js');
const invoiceRoutes = require('./routes/invoiceRoutes.js');
// ... i tak dalej dla innych zasobów

// Importujemy middleware do obsługi błędów
const errorMiddleware = require('./middleware/errorMiddleware.js');
const { sequelize } = require('./models'); // Importujemy instancję Sequelize

const app = express();

// Definiujemy listę dozwolonych źródeł (origins) dla zapytań CORS.
// Jest to kluczowe dla bezpieczeństwa, aby serwer akceptował żądania tylko z zaufanych adresów.
const allowedOrigins = [
  'http://localhost:5173', // Domyślny adres serwera deweloperskiego Vite
  'http://127.0.0.1:5173',
  // Adres URL aplikacji wdrożonej na Vercel
  'https://my-tms-project-frontend-o22jv2q3m-krzysztofs-projects-36780459.vercel.app',
];

// Middleware do parsowania ciasteczek musi być przed CORS, jeśli używasz credentials
app.use(cookieParser());

// Kompresja odpowiedzi - powinna być jak najwyżej
app.use(compression());

// Parsowanie ciała żądania
app.use(express.json({ limit: '10mb' }));

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

// Ochrona przed atakami HTTP Parameter Pollution
app.use(hpp());

// Ochrona przed CSRF - wymaga sesji lub cookie-parser
// const csrfProtection = csurf({ cookie: true }); // Tymczasowo wyłączone

// --- Middleware do kontroli cache ---
// Wyłączamy cache dla wszystkich tras API, aby zapewnić, że klient zawsze otrzymuje świeże dane.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Zaawansowane logowanie z morgan, które zawiera również ciało żądania
if (process.env.NODE_ENV !== 'production') {
  // W trybie deweloperskim używamy morgana do logowania do konsoli w formacie 'dev'
  app.use(morgan('dev'));
} else {
  // W trybie produkcyjnym logujemy do plików za pomocą winstona
  const stream = { write: (message) => logger.info(message.trim()) };
  app.use(morgan('combined', { stream }));
}

// --- Health Check Endpoint ---
app.get('/health', async (req, res) => {
  try {
    // Proste zapytanie do bazy danych, aby sprawdzić, czy połączenie działa.
    await sequelize.authenticate(); // Używamy sequelize.authenticate() do sprawdzenia połączenia
    res.status(200).json({
      status: 'OK',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Health check failed:', { error: error.message });
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