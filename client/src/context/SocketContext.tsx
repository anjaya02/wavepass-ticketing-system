import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { AuthContext } from './AuthContext';

interface SocketContextProps {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextProps>({ socket: null });

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authToken } = useContext(AuthContext);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!authToken) {
      setSocket(null);
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
    const newSocket = io(socketUrl, {
      withCredentials: true,
      auth: {
        token: authToken,
      },
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [authToken]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
