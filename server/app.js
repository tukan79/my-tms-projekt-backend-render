// server/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hpp = require('hpp');

const app = express();

// --- CORE MIDDLEWARE ---
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// --- ALLOWED ORIGINS ---
const PROD_FRONTEND = process.env.FRONTEND_URL; // np. https://my-tms-project-frontend.vercel.app
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
      if (!origin) return callback(null, true); // Postman, curl itd.

      if (allowedOrigins.includes(origin)) return callback(null, true);

      console.log("❌ BLOCKED ORIGIN:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: false,
    optionsSuccessStatus: 200,
  })
);

// globalny preflight
app.options("*", cors());

// --- SECURITY ---
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

app.use("/api/assignments", require("./routes/assignmentRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/zones", require("./routes/zoneRoutes"));
app.use("/api/trailers", require("./routes/trailerRoutes"));
app.use("/api/drivers", require("./routes/driverRoutes"));

// ⭐ POPRAWIONE – właściwy router dla rate cards
app.use("/api/rate-cards", require("./routes/rateCardRoutes"));

module.exports = app;
