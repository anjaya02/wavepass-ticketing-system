const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");

// Validate environment variables first
const env = require("./config/env");
const { init: initSocket } = require("./utils/socket");
const connectDB = require("./config/db");
const ticketPool = require("./classes/TicketPool");
const Configuration = require("./classes/Configuration");
const logger = require("./utils/logger");

// Import routes
const vendorRoutes = require("./routes/vendor");
const customerRoutes = require("./routes/customer");
const configRoutes = require("./routes/config");

// Import error handler
const errorHandler = require("./middleware/errorHandler");
const { errorResponse } = require("./utils/apiResponse");

const app = express();

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows flexible websocket & frontend integration
    crossOriginEmbedderPolicy: false,
  })
);

// CORS Configuration
const allowedOrigins = [
  env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:80",
  "http://localhost",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like curl, Postman, Supertest)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy violation: Unauthorized origin."));
    },
    credentials: true,
  })
);

// Body Parsing Middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.status(200).json({ message: "WavePass Ticketing API is running." });
});

// API Routes
app.use("/api/vendor", vendorRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/config", configRoutes);

// 404 Route Handler
app.use((req, res) => {
  return errorResponse(res, 404, `Route '${req.originalUrl}' not found on this server.`, "ROUTE_NOT_FOUND");
});

// Centralized Global Error Handler
app.use(errorHandler);

/**
 * Initialize TicketPool with current persisted Configuration
 */
const initializeTicketPool = async () => {
  try {
    const config = await Configuration.getInstance();
    const maxTicketCapacity = config.getMaxTicketCapacity();

    await ticketPool.initialize({
      totalTickets: config.getTotalTickets(),
      ticketReleaseRate: config.getTicketReleaseRate(),
      customerRetrievalRate: config.getCustomerRetrievalRate(),
      maxTicketCapacity: maxTicketCapacity,
    });

    logger.info("Ticket pool initialized successfully.");
  } catch (error) {
    logger.error("Error initializing ticket pool:", error);
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
  }
};

/**
 * Start the application server
 */
const startServer = async () => {
  try {
    // 1. Await database connection before attempting to read configuration
    await connectDB();

    // 2. Initialize ticket pool from configuration
    await initializeTicketPool();

    // 3. Bind HTTP server to port
    const PORT = env.PORT || 5000;
    server.listen(PORT, () => {
      logger.info(`🚀 WavePass server running on port ${PORT} [env: ${env.NODE_ENV}]`);
    });
  } catch (error) {
    logger.error("Failed to start server: %s", error.message);
    process.exit(1);
  }
};

// Only start the server directly if executed as main file (not during tests)
if (require.main === module) {
  startServer();
}

module.exports = { app, server, initializeTicketPool };
