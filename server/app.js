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
const FRONTEND =
  process.env.NODE_ENV === "production"
    ? "https://my-tms-project-frontend.onrender.com"
    : "http://localhost:5173";

app.use(
  cors({
    origin: FRONTEND,
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
// ...reszta Twoich tras

module.exports = app;
