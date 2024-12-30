import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./context/AuthContext.tsx";
import { BrowserRouter as Router } from "react-router-dom";
import { SocketProvider } from './context/SocketContext';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <AuthProvider>
      <SocketProvider>
        <App />
        </SocketProvider>
      </AuthProvider>
    </Router>
  </StrictMode>
);
