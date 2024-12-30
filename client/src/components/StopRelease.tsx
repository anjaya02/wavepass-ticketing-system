import React, { useState } from "react";
import Modal from "./Modal";
import { useNavigate } from "react-router-dom"; 

const StopRelease: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMessage, setModalMessage] = useState<string>("");
  const navigate = useNavigate(); 

  const handleStopRelease = async () => {
    try {
      const authToken = localStorage.getItem("authToken");
      if (!authToken) throw new Error("User is not authenticated.");

      const response = await fetch("http://localhost:5000/api/vendor/stop-release", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to stop ticket release.");
      }

      setModalMessage(data.message || "Ticket release stopped successfully.");
      setIsModalOpen(true);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setModalMessage(error.message);
      } else {
        setModalMessage("An unexpected error occurred.");
      }
      setIsModalOpen(true);
    }
  };

  // Handler for 'Go Back' button
  const handleGoBack = () => {
    navigate("/vendor/ticket-management");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800 px-4 py-12">
      <div className="w-full max-w-md bg-gray-900 p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-center text-white mb-6">
          Stop Ticket Release
        </h2>

        <div className="space-y-4">
          {/* Stop Release Button */}
          <button
            onClick={handleStopRelease}
            className="w-full px-4 py-2 bg-red-600 text-white font-semibold rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition duration-200"
          >
            Stop Release
          </button>

          {/* Go Back Button */}
          <button
            onClick={handleGoBack}
            className="w-full px-4 py-2 bg-gray-600 text-white font-semibold rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 transition duration-200"
          >
            Go Back
          </button>
        </div>
      </div>

      {/* Modal for Messages */}
      {isModalOpen && (
        <Modal>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Close Modal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <h3 className="text-xl font-semibold mb-4">Notification</h3>
            <p className="text-gray-700">{modalMessage}</p>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StopRelease;
