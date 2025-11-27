// server/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hpp = require('hpp');
const path = require('path');

const app = express();

// --- CORE MIDDLEWARE ---
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// --- ALLOWED ORIGINS ---
const PROD_FRONTEND = process.env.FRONTEND_URL;           // np. https://my-tms-project-frontend.vercel.app
const LOCALHOST = process.env.CORS_ALLOW_LOCALHOST || "http://localhost:5173";

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [PROD_FRONTEND]
    : [LOCALHOST];

console.log("🌍 Allowed origins:", allowedOrigins);

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
