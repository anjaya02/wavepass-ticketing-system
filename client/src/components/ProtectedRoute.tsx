import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredRole?: "customer" | "vendor"; 
  redirectTo?: string; 
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  redirectTo = "/customer/login",
}) => {
  const { authToken, userRole } = useContext(AuthContext);
  const location = useLocation();

  if (!authToken) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  if (requiredRole && userRole !== requiredRole) {
    const dashboardPath =
      userRole === "customer" ? "/customer/dashboard" : "/vendor/dashboard";
    return <Navigate to={dashboardPath} replace />;
  }

  return children;
};

export default ProtectedRoute;
