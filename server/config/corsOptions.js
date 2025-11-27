// server/config/corsOptions.js

const allowedOrigins = [
  'http://localhost:5173',
  'https://my-tms-project-frontend.onrender.com'
];

module.exports = {
  origin: (origin, callback) => {
    // allow mobile apps / curl / postman without origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    console.log("❌ CORS blocked:", origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
};
