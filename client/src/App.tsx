import React from "react";
import Header from "./components/Header";
import VendorLogin from "./components/VendorLogin";
import VendorRegister from "./components/VendorRegister";
import Home from "./components/Home";
import "./index.css";
import {
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import CustomerRegister from "./components/CustomerRegister";
import CustomerLogin from "./components/CustomerLogin";
import TicketDisplay from "./components/CustomerTicketDisplay";
import PaymentPage from "./components/PaymentPage";
import CustomerPurchasedTickets from "./components/CustomerPurchasedTickets";
import VendorDashboard from "./components/VendorDashboard";
import VendorTicketManagement from "./components/VendorTicketManagement";
import StartRelease from "./components/StartRelease"; 
import StopRelease from "./components/StopRelease"; 

// Use ProtectedRoute when ready
// import ProtectedRoute from "./components/ProtectedRoute";

const App: React.FC = () => {
  return (
    <div className="bg-gray-800 min-h-screen">
      <Header />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/vendor/login" element={<VendorLogin />} />
        <Route path="/vendor/register" element={<VendorRegister />} />
        <Route path="/customer/register" element={<CustomerRegister />} />
        <Route path="/customer/login" element={<CustomerLogin />} />

        {/* Protected Routes */}
        {/* Uncomment and configure ProtectedRoute as needed */}
        {/* <Route
          path="/customer/dashboard"
          element={
            <ProtectedRoute>
              <TicketDisplay />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer/payment"
          element={
            <ProtectedRoute>
              <PaymentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer/purchasedTickets"
          element={
            <ProtectedRoute>
              <CustomerPurchasedTickets />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/dashboard"
          element={
            <ProtectedRoute redirectTo="/vendor/login">
              <VendorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/ticket-management"
          element={
            <ProtectedRoute>
              <VendorTicketManagement />
            </ProtectedRoute>
          }
        />
        */}

        {/* Unprotected Routes for Testing */}
        <Route path="/vendor/start-release" element={<StartRelease />} /> 
        <Route path="/vendor/stop-release" element={<StopRelease />} /> 
        <Route path="/customer/dashboard" element={<TicketDisplay />} />
        <Route path="/customer/payment" element={<PaymentPage />} />
        <Route path="/customer/purchasedTickets" element={<CustomerPurchasedTickets />} />
        <Route path="/vendor/dashboard" element={<VendorDashboard />} />
        <Route path="/vendor/ticket-management" element={<VendorTicketManagement />} />

        {/* Redirect any undefined routes to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export default App;
