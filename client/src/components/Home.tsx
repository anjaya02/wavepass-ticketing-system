import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import HomePageImage from "../assets/HomePage.svg";
import ConfigurationForm from "./ConfigurationForm";

const Home: React.FC = () => {
  const navigate = useNavigate();

  // State to control the visibility of the ConfigurationForm modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

  const handleRegisterClick = () => {
    navigate("/customer/register");
  };

  const handleSetConfigurationsClick = () => {
    setIsConfigModalOpen(true);
  };

  const handleCloseConfigModal = () => {
    setIsConfigModalOpen(false);
  };

  return (
    <div className="flex flex-col-reverse md:flex-row items-center justify-between min-h-screen bg-gray-800 px-8 py-12">
      {/* Text Content */}
      <div className="max-w-2xl text-center md:text-left animate-fadeInLeft">
        <h1 className="text-3xl sm:text-6xl font-bold text-white mb-4 transform transition-transform duration-700 hover:scale-105">
          Welcome to WavePass
        </h1>
        <p className="text-gray-400 text-lg sm:text-xl mb-6 animate-fadeInUp delay-200">
          Your real-time boat ticketing solution! With WavePass, you can check
          availability and book your tickets seamlessly from anywhere, no need
          to visit the pier first. Plan your trip effortlessly and set sail
          without the hassle.
        </p>

        {/* Buttons Container */}
        <div className="flex flex-col md:flex-row justify-center md:justify-start space-y-4 md:space-y-0 md:space-x-4">
          {/* Set Configurations Button */}
          <button
            onClick={handleSetConfigurationsClick}
            className="px-8 py-3 bg-green-500 text-white font-semibold rounded shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-transform transform hover:translate-y-1 duration-300"
          >
            Set Configurations →
          </button>

          {/* Let's Buy Your Ticket Button */}
          <button
            onClick={handleRegisterClick}
            className="px-8 py-3 bg-blue-500 text-white font-semibold rounded shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-transform transform hover:translate-y-1 duration-300"
          >
            Let's buy your ticket &rarr;
          </button>
        </div>
      </div>

      {/* SVG Image */}
      <div className="w-full max-w-md mb-8 md:mb-0 animate-fadeInRight">
        <img
          src={HomePageImage}
          alt="WavePass Illustration"
          className="w-full h-auto transform transition-transform duration-700 hover:scale-110"
        />
      </div>

      {/* Configuration Form Modal */}
      {isConfigModalOpen && (
        <ConfigurationForm onClose={handleCloseConfigModal} />
      )}
    </div>
  );
};

export default Home;
