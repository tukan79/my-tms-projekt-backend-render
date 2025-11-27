// server/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hpp = require('hpp');

const app = express();

// 1) Parsowanie
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// 2) CORS — najważniejsze!
const FRONTEND =
  process.env.NODE_ENV === "production"
    ? "https://my-tms-projekt-frontend.onrender.com"
    : "http://localhost:5173";

console.log("🌐 CORS ALLOW ORIGIN =", FRONTEND);
console.log("🌐 NODE_ENV =", process.env.NODE_ENV);

app.use(
  cors({
    origin: FRONTEND,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 3) Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

// 4) HPP
app.use(hpp());

// 5) Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// 6) Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/surcharge-types", require("./routes/surchargeTypeRoutes"));
app.use("/api/runs", require("./routes/runRoutes"));

module.exports = app;
