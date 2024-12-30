import React, { createContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  authToken: string | null;
  userRole: "customer" | "vendor" | null;
  customerId: string | null;
  vendorId: string | null;
  login: (token: string, role: "customer" | "vendor", id: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  authToken: null,
  userRole: null,
  customerId: null,
  vendorId: null,
  login: () => {},
  logout: () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const navigate = useNavigate();

  // Initialize state from localStorage
  const [authToken, setAuthToken] = useState<string | null>(
    localStorage.getItem("authToken")
  );
  const [userRole, setUserRole] = useState<"customer" | "vendor" | null>(
    (localStorage.getItem("userRole") as "customer" | "vendor") || null
  );
  const [customerId, setCustomerId] = useState<string | null>(
    localStorage.getItem("customerId")
  );
  const [vendorId, setVendorId] = useState<string | null>(
    localStorage.getItem("vendorId")
  );

  const login = (
    token: string,
    role: "customer" | "vendor",
    id: string
  ) => {
    // Update state
    setAuthToken(token);
    setUserRole(role);
    if (role === "customer") {
      setCustomerId(id);
      setVendorId(null); // Ensure vendorId is null
      // Update localStorage
      localStorage.setItem("customerId", id);
      localStorage.removeItem("vendorId");
    } else {
      setVendorId(id);
      setCustomerId(null); // Ensure customerId is null
      // Update localStorage
      localStorage.setItem("vendorId", id);
      localStorage.removeItem("customerId");
    }
    // Store token and role in localStorage
    localStorage.setItem("authToken", token);
    localStorage.setItem("userRole", role);
  };

  const logout = () => {
    // Clear state
    setAuthToken(null);
    setUserRole(null);
    setCustomerId(null);
    setVendorId(null);
    // Clear localStorage
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("customerId");
    localStorage.removeItem("vendorId");
    navigate("/");
  };

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const role = localStorage.getItem("userRole") as "customer" | "vendor" | null;
    const cId = localStorage.getItem("customerId");
    const vId = localStorage.getItem("vendorId");

    if (token) {
      setAuthToken(token);
    }

    if (role) {
      setUserRole(role);
    }

    if (cId) {
      setCustomerId(cId);
    }

    if (vId) {
      setVendorId(vId);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authToken,
        userRole,
        customerId,
        vendorId,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};