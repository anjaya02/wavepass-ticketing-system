const dotenv = require("dotenv");
dotenv.config();

/**
 * Validates required environment variables and fails fast at startup
 * if critical configurations are missing.
 */
const validateEnv = () => {
  const required = ["JWT_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const errorMsg = `FATAL CONFIG ERROR: Missing required environment variables: ${missing.join(", ")}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
};

validateEnv();

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/wavepass",
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_URL: process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173",
  EVENT_NAME: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
  EVENT_DATE: process.env.EVENT_DATE || "2024-12-20",
  TICKET_PRICE: parseInt(process.env.TICKET_PRICE, 10) || 2800,
};
