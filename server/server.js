// server/server.js
if (process.env.NODE_ENV !== "production") {
  require('dotenv').config();
}

const app = require('./app');
const { sequelize } = require('./models');
const userService = require('./services/userService.js');

const PORT = process.env.PORT || 10000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("🐘 DB connected");

    await userService.createDefaultAdminUser();

    app.listen(PORT, "0.0.0.0", () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );

  } catch (err) {
    console.error("🔥 Server failed:", err);
    process.exit(1);
  }
};

startServer();
