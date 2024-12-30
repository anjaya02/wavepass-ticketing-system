import { io, Socket } from "socket.io-client";

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket: Socket | null = null;

export const initiateSocket = (token: string) => {
  socket = io(SOCKET_SERVER_URL, {
    auth: {
      token, // Pass JWT token for authentication if required
    },
  });

  console.log(`Connecting socket...`);

  socket.on("connect", () => {
    console.log("Connected to socket server");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from socket server");
  });
};

export const disconnectSocket = () => {
  console.log("Disconnecting socket...");
  if (socket) socket.disconnect();
};

export const getSocket = (): Socket | null => socket;
