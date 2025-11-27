// server/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hpp = require('hpp');

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// --- DYNAMIC ORIGINS ---
const PROD_FRONTEND = process.env.FRONTEND_URL;
const LOCALHOST = process.env.CORS_ALLOW_LOCALHOST || "http://localhost:5173";

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [PROD_FRONTEND]      // tylko produkcja
    : [LOCALHOST];         // tylko localhost

console.log("🌍 Allowed origins:", allowedOrigins);

// --- CORS ---
app.use(
  cors({
    origin: (origin, callback) => {
      // 🔥 pozwalamy na brak origin (np. curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("❌ BLOCKED ORIGIN:", origin);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// --- HELMET ---
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
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/runs", require("./routes/runRoutes"));
app.use("/api/surcharge-types", require("./routes/surchargeTypeRoutes"));

module.exports = app;
