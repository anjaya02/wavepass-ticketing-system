let io;
const connectedClients = new Map(); // Map to store customerId and socketId
const connectedVendors = new Map(); // Map to store vendorId and socketId

const initSocket = (server) => {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("A client connected:", socket.id);

    // Listen for 'register' event to associate customerId with socket.id
    socket.on("register", (customerId) => {
      console.log(`Registering customerId ${customerId} with socketId ${socket.id}`);
      connectedClients.set(customerId, socket.id);
    });

    // Listen for 'registerVendor' event to associate vendorId with socket.id
    socket.on("registerVendor", (vendorId) => {
      console.log(`Registering vendorId ${vendorId} with socketId ${socket.id}`);
      connectedVendors.set(vendorId, socket.id);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      // Remove the socket from connected clients
      connectedClients.forEach((value, key) => {
        if (value === socket.id) {
          connectedClients.delete(key);
        }
      });

      // Remove the socket from connected vendors
      connectedVendors.forEach((value, key) => {
        if (value === socket.id) {
          connectedVendors.delete(key);
        }
      });
    });
  });
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

const getConnectedClientSocketId = (customerId) => {
  return connectedClients.get(customerId);
};

const getConnectedVendorSocketId = (vendorId) => {
  return connectedVendors.get(vendorId);
};

module.exports = {
  init: initSocket,
  getIO,
  getConnectedClientSocketId, 
  getConnectedVendorSocketId, 
};
