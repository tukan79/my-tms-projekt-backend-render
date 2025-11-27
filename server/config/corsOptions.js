// server/config/corsOptions.js

const allowedOrigins = [
  "http://localhost:5173",                               // Lokalny frontend (DEV)
  "https://my-tms-project-frontend.onrender.com",        // Produkcyjny frontend (Render)
];

const corsOptions = {
  origin: (origin, callback) => {
    // Pozwalamy na brak origin (np. Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`❌ CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 204,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
};

module.exports = corsOptions;
