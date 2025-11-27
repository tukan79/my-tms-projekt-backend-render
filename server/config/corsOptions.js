// server/config/corsOptions.js

const allowedOrigins = [
  "http://localhost:5173",
  "https://my-tms-projekt-frontend.onrender.com", 
];

app.use(cors({
  origin: function (origin, callback) {
    console.log("🌍 CORS check origin:", origin);

    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ CORS blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
