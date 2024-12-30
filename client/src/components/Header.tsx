import React from "react";
import { Link, useLocation } from "react-router-dom";

const AUTH_ROUTES = [
  "/vendor/login",
  "/vendor/dashboard",
  "/vendor/register",
  "/vendor/ticket-management",
  "/vendor/start-release",
  "/vendor/stop-release",
];

const Header: React.FC = () => {
  const location = useLocation();
  const isAuthPage = AUTH_ROUTES.includes(location.pathname);

  return (
    <header className="text-gray-400 bg-gray-900 body-font">
      <div className="container mx-auto flex p-5 flex-row items-center justify-between">
        {/* Title */}
        <Link to="/" className="text-white font-bold text-xl" aria-label="Home">
          Ticketing System
        </Link>

        {/* Conditionally render Vendor button if not on auth pages */}
        {!isAuthPage && (
          <Link to="/vendor/login" aria-label="Vendor Login">
            <button className="inline-flex items-center text-lg bg-gray-800 border-0 py-2.5 px-3 focus:outline-none hover:bg-gray-700 rounded text-white">
              Vendor <span>&#10132;</span>
            </button>
          </Link>
        )}
      </div>
    </header>
  );
};

export default Header;
