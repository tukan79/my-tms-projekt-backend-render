// server/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hpp = require('hpp');
const path = require('node:path');

const app = express();
app.set('trust proxy', 1);

// --- CORE MIDDLEWARE ---
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// --- ALLOWED ORIGINS ---
const DEFAULT_FRONTEND =
  process.env.FRONTEND_URL ||
  process.env.CLIENT_URL ||
  "https://my-tms-project-frontend.vercel.app";
const LOCALHOST = process.env.CORS_ALLOW_LOCALHOST || "http://localhost:5173";
const ALLOW_VERCEL_PREVIEWS = (process.env.CORS_ALLOW_VERCEL_PREVIEWS || "true") === "true";
const VERCEL_PROJECT_PREFIX = process.env.CORS_VERCEL_PROJECT_PREFIX || "my-tms-project-frontend";

const allowedOrigins = Array.from(
  new Set(
    (process.env.NODE_ENV === "production"
      ? [DEFAULT_FRONTEND, LOCALHOST]
      : [LOCALHOST, DEFAULT_FRONTEND]
    ).filter(Boolean)
  )
);

console.log("🌍 Allowed origins:", allowedOrigins);

const isAllowedVercelPreviewOrigin = (origin) => {
  if (!ALLOW_VERCEL_PREVIEWS) return false;

  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:") return false;
    if (!hostname.endsWith(".vercel.app")) return false;
    return hostname === `${VERCEL_PROJECT_PREFIX}.vercel.app` || hostname.startsWith(`${VERCEL_PROJECT_PREFIX}-`);
  } catch {
    return false;
  }
};

// --- CORS CONFIG ---
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        // requests without origin (Postman, mobile apps, etc.) — do not block
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (isAllowedVercelPreviewOrigin(origin)) {
        return callback(null, true);
      }
      console.warn("❌ BLOCKED ORIGIN:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: false,
    optionsSuccessStatus: 200,
  })
);

// Global preflight handler (na wypadek, gdyby cors nie zadziałał automatycznie)
app.options("*", cors());

// --- SECURITY MIDDLEWARE ---
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  })
);
app.use(hpp());

// --- HEALTH CHECK ---
app.get("/health", (req, res) => res.json({ status: "ok" }));

// --- ROUTES ---
// Upewnij się, że te ścieżki zgadzają się z faktycznymi plikami w folderze /routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/runs", require("./routes/runRoutes"));
app.use("/api/surcharge-types", require("./routes/surchargeTypeRoutes"));
app.use("/api/assignments", require("./routes/assignmentRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/zones", require("./routes/postcodeZoneRoutes"));        // poprawiona ścieżka
app.use("/api/trailers", require("./routes/trailerRoutes"));
app.use("/api/drivers", require("./routes/driverRoutes"));
app.use("/api/rate-cards", require("./routes/rateCardRoutes"));      // zamiast nieistniejącego rateRoutes
app.use("/api/feedback", require("./routes/feedbackRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/trucks", require("./routes/truckRoutes"));
app.use("/api/optimization", require("./routes/optimizationRoutes"));

// === Catch-all dla nieznanych tras ===
app.use((req, res, next) => {
  res.status(404).json({ error: "Not found" });
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS blocked this origin" });
  }
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
