import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io, Socket } from "socket.io-client"; 

interface EventData {
  eventDate: string;
  ticketPrice: number;
  availableTickets: number;
  maxTicketCapacity: number;
}

const TicketDisplay: React.FC = () => {
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<number>(1);
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  const navigate = useNavigate();

  // Fetch event data from the backend
  useEffect(() => {
    const fetchEventData = async () => {
      setIsFetching(true);
      try {
        const token = localStorage.getItem("authToken");
        console.log("Retrieved Token:", token); 

        if (!token) {
          throw new Error("Authentication token is missing. Please log in.");
        }

        const response = await axios.get<EventData>(
          "http://localhost:5000/api/customers/available-tickets",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setEventData(response.data);
        setIsFetching(false); 
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          console.error(
            "Error fetching event data:",
            error.response?.data || error.message
          );
          setMessage(
            error.response?.data?.message ||
              "An error occurred while fetching event data."
          );
        } else {
          console.error("Unexpected error:", error);
          setMessage("An unexpected error occurred.");
        }
        setIsFetching(false);
      }
    };

    fetchEventData();
  }, []);

  useEffect(() => {
    const socket: Socket = io("http://localhost:5000");

    socket.on(
      "availableTicketsUpdate",
      (data: { eventDate: string; availableTickets: number }) => {
        if (eventData && data.eventDate === eventData.eventDate) {
          setEventData((prevData) =>
            prevData
              ? { ...prevData, availableTickets: data.availableTickets }
              : prevData
          );
        }
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [eventData]);

  // Handle ticket selection change
  const handleTicketChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);

    if (eventData) {
      if (value > eventData.availableTickets) {
        setSelectedTickets(eventData.availableTickets);
      } else if (value < 1) {
        setSelectedTickets(1);
      } else {
        setSelectedTickets(value);
      }
    }
  };

  // Handle proceed to payment
  const handleProceedToPayment = async () => {
    if (eventData) {
      try {
        setIsLoading(true); // Start loading

        // Store selected tickets in localStorage
        localStorage.setItem("selectedTickets", selectedTickets.toString());

        // Simulate payment processing delay (optional)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        navigate("/customer/payment");
        setIsLoading(false); // End loading
      } catch (error) {
        console.error("Payment processing error:", error); // Log error to console
        setMessage("An error occurred during payment processing.");
        setIsLoading(false); // Ensure loading ends even if there's an error
      }
    } else {
      setMessage("Event details are not available.");
    }
  };

  // Handle navigation to Purchased Tickets
  const handleViewPurchasedTickets = () => {
    navigate("/customer/purchasedTickets");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800 px-4">
      <div className="w-full max-w-lg bg-gray-900 p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-center text-white mb-6">
          Available Tickets
        </h2>

        {message && (
          <div
            className={`mb-4 text-center text-sm p-2 rounded ${
              message.includes("successful")
                ? "bg-green-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {message}
          </div>
        )}

        {isFetching ? (
          <p className="text-gray-400 text-center">
            Loading event details...
          </p>
        ) : eventData ? (
          <div>
            {/* Event Date */}
            <div className="mb-4">
              <p className="text-gray-300">
                <span className="font-medium">Event Date:</span>{" "}
                {new Date(eventData.eventDate).toLocaleDateString()}
              </p>
            </div>

            {/* Ticket Price */}
            <div className="mb-4">
              <p className="text-gray-300">
                <span className="font-medium">Ticket Price:</span> LKR{" "}
                {eventData.ticketPrice.toLocaleString()}
              </p>
            </div>

            {/* Available Tickets */}
            <div className="mb-4">
              <p className="text-gray-300">
                <span className="font-medium">
                  Available Tickets to purchase:
                </span>{" "}
                {eventData.availableTickets}
              </p>
            </div>

            {/* Select Number of Tickets */}
            <div className="mb-6">
              <label
                htmlFor="tickets"
                className="block text-gray-300 mb-2 font-medium"
              >
                Select Tickets:
              </label>
              <input
                type="number"
                id="tickets"
                name="tickets"
                min="1"
                max={eventData.availableTickets}
                value={selectedTickets}
                onChange={handleTicketChange}
                className="w-full px-3 py-2 border border-gray-700 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-gray-400 text-sm mt-1">
                You can purchase up to {eventData.availableTickets} tickets.
              </p>
            </div>

            {/* Display Total */}
            <div className="mb-6">
              <p className="text-gray-300">
                <span className="font-medium">Total:</span> LKR{" "}
                {(selectedTickets * eventData.ticketPrice).toLocaleString()}
              </p>
            </div>

            {/* Proceed to Payment Button */}
            <button
              onClick={handleProceedToPayment}
              className={`w-full py-2 px-4 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition-colors flex items-center justify-center ${
                isLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 mr-3 inline-block"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4.22 4.22a.75.75 0 011.06 0L12 10.94l6.72-6.72a.75.75 0 111.06 1.06L13.06 12l6.72 6.72a.75.75 0 11-1.06 1.06L12 13.06l-6.72 6.72a.75.75 0 11-1.06-1.06L10.94 12 4.22 5.28a.75.75 0 010-1.06z"
                    ></path>
                  </svg>
                  Processing...
                </>
              ) : (
                "Proceed to Payment"
              )}
            </button>

            {/* View Purchased Tickets Button */}
            <button
              onClick={handleViewPurchasedTickets}
              className="w-full py-2 px-4 mt-4 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition-colors"
            >
              View Purchased Tickets
            </button>
          </div>
        ) : (
          <p className="text-gray-400 text-center">
            No event data available.
          </p>
        )}
      </div>
    </div>
  );
};

export default TicketDisplay;
