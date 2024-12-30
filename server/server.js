const express = require("express");
const http = require("http");
const dotenv = require("dotenv");
const { init: initSocket } = require("./utils/socket");
const connectDB = require("./config/db");
const cors = require("cors");
const ticketPool = require("./classes/TicketPool"); // Singleton instance
const Configuration = require("./classes/Configuration");


// Import routes
const vendorRoutes = require("./routes/vendor");
const customerRoutes = require("./routes/customer");
const configRoutes = require("./routes/config");

// Import error handler
const errorHandler = require("./middleware/errorHandler");

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Middleware
app.use(express.json());
// CORS Configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// View available tickets (separate route)
app.get("/tickets/available", async (req, res) => {
  try {
    const availableTickets = await ticketPool.getAvailableTickets();
    res.status(200).json({ availableTickets });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching available tickets.",
      error: error.message,
    });
  }
});

// Route to add tickets (for example, add 10 tickets)
app.post("/api/add-tickets", async (req, res) => {
  const { ticketCount } = req.body;

  try {
    const poolResult = await ticketPool.addTickets(ticketCount);
    let responseMessage = `${poolResult.added} tickets added successfully.`;
    if (poolResult.notAdded > 0) {
      responseMessage += ` ${poolResult.notAdded} tickets could not be added due to pool capacity limits.`;
    }

    const statusCode = poolResult.notAdded > 0 ? 400 : 200;

    res.status(statusCode).json({
      message: responseMessage,
      addedTickets: poolResult.added,
      notAddedTickets: poolResult.notAdded,
    });
  } catch (error) {
    console.error("Error adding tickets:", error);
    res
      .status(500)
      .json({ message: "Error adding tickets.", error: error.message });
  }
});

// Use Routes
app.use("/api/vendor", vendorRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/config", configRoutes);

// Use Global Error Handler
app.use(errorHandler);

// Define a simple route to check server status
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Initialize the Ticket Pool
const initializeTicketPool = async () => {
  try {
    // Define your configuration parameters
    const config = await Configuration.getInstance();
    const maxTicketCapacity = config.getMaxTicketCapacity();

    await ticketPool.initialize({
      totalTickets: 0,
      ticketReleaseRate: 0, 
      customerRetrievalRate: 0, 
      maxTicketCapacity: maxTicketCapacity,
    });

    console.log("Ticket pool initialized successfully.");
  } catch (error) {
    console.error("Error initializing ticket pool:", error);
    process.exit(1); // Exit the process if initialization fails
  }
};

// Start the Server after initializing the Ticket Pool
const startServer = async () => {
  await initializeTicketPool();

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Server is up and running on port ${PORT}`);
  });
};

startServer();
