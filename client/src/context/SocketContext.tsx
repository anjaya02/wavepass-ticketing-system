
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { AuthContext } from './AuthContext';

interface SocketContextProps {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextProps>({ socket: null });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authToken, customerId, vendorId, userRole } = useContext(AuthContext);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!authToken) {
      return;
    }

    const newSocket = io("http://localhost:5000", {
      withCredentials: true,
      auth: {
        token: authToken,
      },
    });

    newSocket.on("connect", () => {
      console.log("Connected to socket server");

      // Register the user after connection
      if (userRole === 'customer' && customerId) {
        newSocket.emit("register", customerId);
      } else if (userRole === 'vendor' && vendorId) {
        newSocket.emit("registerVendor", vendorId);
      }
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from socket server");
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [authToken, customerId, vendorId, userRole]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
