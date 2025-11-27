require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hpp = require('hpp');
const path = require('path');

const app = express();

// =========================
// 1) COOKIE PARSER + JSON
// =========================
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// =========================
// 2) CORS – MUSI BYĆ PIERWSZY
// =========================
const FRONTEND =
  process.env.NODE_ENV === "production"
    ? "https://my-tms-project-frontend.onrender.com"
    : "http://localhost:5173";

app.use(
  cors({
    origin: FRONTEND,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);

// =========================
// 3) HELMET — z WYŁĄCZONYMI
//    politykami cross-origin
// =========================
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// =========================
// 4) Ochrona HPP
// =========================
app.use(hpp());

// =========================
// 5) ROUTES
// =========================
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/runs", require("./routes/runRoutes"));
app.use("/api/surcharge-types", require("./routes/surchargeTypeRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
// ... Twoje inne trasy

// =========================
// 6) STATIC FILES (PROD)
// =========================
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../public")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "index.html"));
  });
}

module.exports = app;
