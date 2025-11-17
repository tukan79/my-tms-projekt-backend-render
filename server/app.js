// server/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const os = require('os');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const hpp = require('hpp');
const logger = require('./config/logger.js');
const { sequelize } = require('./models');

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

const errorMiddleware = require('./middleware/errorMiddleware.js');

const app = express();

// --- TRUST PROXY (Render cookies) ---
app.set('trust proxy', 1);

// === CORE MIDDLEWARE ===
app.use(cookieParser());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(helmet());
app.use(hpp());

// === CORS KONFIGURACJA ===

// produkcyjny frontend (Vercel Production)
const mainFrontend = process.env.FRONTEND_URL;

// dowolna domena .vercel.app — PREVIEW URLs Vercel
const vercelRegex = /^https:\/\/.*\.vercel\.app$/;

// Wszystkie dopuszczalne domeny
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  mainFrontend
].filter(Boolean);

// CORS opcje (działające z cookies)
const corsOptions = {
  origin: (origin, callback) => {
    // brak origin = Postman / curl
    if (!origin) return callback(null, true);

    // frontend produkcyjny
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // wszystkie subdomeny vercel.app
    if (vercelRegex.test(origin)) return callback(null, true);

    // blokuj resztę
    console.log('❌ BLOCKED BY CORS:', origin);
    return callback(new Error('CORS blocked by server.'), false);
  },
  credentials: true, // bardzo ważne dla cookies
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// === RATE LIMITING ===
if (process.env.NODE_ENV === 'production') {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', apiLimiter);
}

// === NO CACHE FOR API ===
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// === LOGGING ===
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  const stream = { write: (msg) => logger.info(msg.trim()) };
  app.use(morgan('combined', { stream }));
}

// === HEALTH CHECK ===
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
  });
});

// === STATIC FILES ===
app.use(express.static(path.join(__dirname, 'public')));

// === API ROUTES ===
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

// === 404 HANDLER ===
app.use((req, res) =>
  res.status(404).json({
    error: `Resource not found: ${req.originalUrl}`,
  })
);

// === ERROR HANDLER ===
app.use(errorMiddleware);

module.exports = app;
