// server/app.js
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const helmet = require('helmet');
const os = require('node:os');
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

// Wszystkie dopuszczalne domeny
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://my-tms-project-frontend.vercel.app', // Twoja domena Vercel
  'https://my-tms-project-frontend.onrender.com', // Nowa domena na Render
];

// CORS opcje (działające z cookies)
app.use(
  cors({
    origin: function (origin, callback) {
      // Zezwalaj na żądania bez 'origin' (np. z Postmana, testów serwerowych)
      // LUB gdy 'origin' jest na liście dozwolonych
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // bardzo ważne dla cookies
  })
);

// === RATE LIMITING ===
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: process.env.NODE_ENV === 'production' ? 1000 : 5000, // Mniej w produkcji
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Bardziej restrykcyjny limiter dla endpointów autoryzacji
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  message: { error: 'Too many authentication attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

// === NO CACHE FOR API ===
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// === LOGGING ===
if (process.env.NODE_ENV === 'production') {
  const stream = { write: (msg) => logger.info(msg.trim()) };
  app.use(morgan('combined', { stream }));
} else {
  app.use(morgan('dev'));
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
