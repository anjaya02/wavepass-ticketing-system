const mongoose = require("mongoose");
const logger = require("../utils/logger");

/**
 * Connect to MongoDB with connection pooling and error resilience.
 */
const connectDB = async (uri) => {
  const connectionUri = uri || process.env.MONGO_URI || "mongodb://localhost:27017/wavepass";

  // If already connected, skip reconnecting
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    await mongoose.connect(connectionUri, {
      maxPoolSize: 50, // Optimal for concurrent requests
    });
    logger.info(`MongoDB Connected successfully to: ${connectionUri.replace(/\/\/.*@/, "//<credentials>@")}`);
  } catch (err) {
    logger.error("MongoDB Connection Error: %s", err.message);
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
    throw err;
  }
};

module.exports = connectDB;
