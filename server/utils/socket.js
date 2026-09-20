const jwt = require("jsonwebtoken");
const logger = require("./logger");

let io;

const initSocket = (server) => {
  const { Server } = require("socket.io");
  
  const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:80",
    "http://localhost",
  ].filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("CORS policy violation: Unauthorized origin for WebSocket."));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Authenticate socket handshake using JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (token) {
      try {
        const secret = process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);
        socket.user = decoded; // { id, role }
        logger.debug(`Socket authenticated for user: ${decoded.id} (${decoded.role})`);
      } catch (err) {
        return next(new Error("Authentication error: Invalid or expired token."));
      }
    }
    // Allow unauthenticated connection for public guest broadcasts
    next();
  });

  io.on("connection", (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    // Join private room derived strictly from verified JWT
    if (socket.user && socket.user.id) {
      socket.join(`user:${socket.user.id}`);
      if (socket.user.role === "vendor") {
        socket.join("role:vendor");
      } else if (socket.user.role === "customer") {
        socket.join("role:customer");
      }
    }

    socket.on("disconnect", () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = {
  init: initSocket,
  getIO,
};
