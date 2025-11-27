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

// ROUTES
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

app.set('trust proxy', 1);

// 🌐 LOGGING ORIGIN (diagnostyka CORS)
app.use((req, res, next) => {
  console.log("🌐 Incoming Origin:", req.headers.origin);
  next();
});

app.use(cookieParser());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// === CORS CONFIG (MUST BE BEFORE HELMET) ===
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  /\.vercel\.app$/,
  /\.onrender\.com$/,
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const allowed = allowedOrigins.some((allowed) =>
        allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
      );

      if (allowed) {
        return callback(null, origin);
      }

      console.warn("❌ CORS blocked origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// === HELMET (must NOT override CORS policy) ===
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(hpp());

// === RATE LIMITING ===
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 1000 : 5000,
  message: { error: 'Too many requests, try again later' },
});
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  message: { error: 'Too many login attempts' },
});
app.use('/api/auth', authLimiter);

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
app.use((req, res) => {
  res.status(404).json({
    error: `Resource not found: ${req.originalUrl}`,
  });
});

// === GLOBAL ERROR HANDLER ===
app.use(errorMiddleware);

module.exports = app;
