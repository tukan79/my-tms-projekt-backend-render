// server/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hpp = require('hpp');

const app = express();

// -----------------------------------
// 1) PARSERY I KOMPR
// -----------------------------------
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// -----------------------------------
// 2) CORS (MUSI BYĆ PRZED HELMET!)
// -----------------------------------

// 👉 DWA FRONTENDY — localhost + produkcyjny
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://my-tms-projekt-frontend.onrender.com",
];

// pozwalamy tylko jeśli origin jest na liście
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        console.log("🚫 BLOCKED CORS ORIGIN:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  })
);

// -----------------------------------
// 3) HELMET
// -----------------------------------
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// -----------------------------------
// 4) HPP
// -----------------------------------
app.use(hpp());

// -----------------------------------
// 5) HEALTH CHECK
// -----------------------------------
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// -----------------------------------
// 6) ROUTES
// -----------------------------------
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/runs", require("./routes/runRoutes"));
app.use("/api/surcharge-types", require("./routes/surchargeTypeRoutes"));
// ... dodaj resztę tras

module.exports = app;
