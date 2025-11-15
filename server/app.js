// server/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const os = require('os');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const logger = require('./config/logger.js');

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

// -------------------------------
// 🔧 BASIC MIDDLEWARE
// -------------------------------
app.use(cookieParser());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// -------------------------------
// 🔧 HELMET – FIX FOR VERCEL/REACT
// -------------------------------
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // required for React on Vercel
  })
);

// -------------------------------
// 🔧 STATIC FILES (manifest, icons)
// Required for frontend to load without 401
// -------------------------------
const publicPath = path.join(__dirname, 'public');
app.use('/manifest.json', (req, res) => {
  res.sendFile(path.join(publicPath, 'manifest.json'));
});
app.use('/favicon.ico', express.static(path.join(publicPath, 'favicon.ico')));
app.use('/icons', express.static(path.join(publicPath, 'icons')));
app.use(express.static(publicPath)); // normal static serving

// -------------------------------
// 🔧 CORS CONFIG
// Supports dynamic Vercel URLs
// -------------------------------
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
  /^https:\/\/.*my-tms-project-frontend.*\.vercel\.app$/,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow Postman and curl

    const allowed = allowedOrigins.some((o) =>
      typeof o === 'string'
        ? o === origin
        : o instanceof RegExp
        ? o.test(origin)
        : false
    );

    if (allowed) return callback(null, true);
    return callback(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// -------------------------------
// 🔧 RATE LIMITING (only prod)
// -------------------------------
if (process.env.NODE_ENV === 'production') {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', apiLimiter);
}

app.use(hpp());

// -------------------------------
// 🔧 NO-CACHE FOR API
// -------------------------------
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// -------------------------------
// 🔧 LOGGING
// -------------------------------
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  const stream = { write: (msg) => logger.info(msg.trim()) };
  app.use(morgan('combined', { stream }));
}

// -------------------------------
// 🔧 HEALTH CHECK (Render required)
// -------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
  });
});

// -------------------------------
// 🔧 API ROUTES
// -------------------------------
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

// -------------------------------
// 🔧 FALLBACK — SPA FRONTEND SUPPORT
// Must be BEFORE 404
// -------------------------------
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(publicPath, 'index.html'));
});

// -------------------------------
// 🔧 404 HANDLER
// -------------------------------
app.use((req, res) => {
  res.status(404).json({ error: `Resource not found: ${req.originalUrl}` });
});

// -------------------------------
// 🔧 ERROR MIDDLEWARE
// -------------------------------
app.use(errorMiddleware);

module.exports = app;
