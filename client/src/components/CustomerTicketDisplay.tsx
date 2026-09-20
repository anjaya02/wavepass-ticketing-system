import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";

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
  const [isFetching, setIsFetching] = useState<boolean>(true);

  const navigate = useNavigate();
  const { socket } = useSocket();

  // Fetch event data from the backend
  useEffect(() => {
    const fetchEventData = async () => {
      setIsFetching(true);
      try {
        const response = await api.get<EventData>("/customers/available-tickets");
        setEventData(response.data);
      } catch (error: unknown) {
        console.error("Error fetching available tickets:", error);
        setMessage("Unable to load ticket availability. Please try again.");
      } finally {
        setIsFetching(false);
      }
    };

    fetchEventData();
  }, []);

  // Real-time updates via shared Socket.IO connection
  useEffect(() => {
    if (!socket) return;

    const handleTicketUpdate = (data: { availableTickets: number }) => {
      setEventData((prev) =>
        prev ? { ...prev, availableTickets: data.availableTickets } : prev
      );
    };

    socket.on("ticketUpdate", handleTicketUpdate);

    return () => {
      socket.off("ticketUpdate", handleTicketUpdate);
    };
  }, [socket]);

  // Handle ticket selection change
  const handleTicketChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value)) return;

    if (eventData) {
      if (value > eventData.availableTickets) {
        setSelectedTickets(Math.max(1, eventData.availableTickets));
      } else if (value < 1) {
        setSelectedTickets(1);
      } else {
        setSelectedTickets(value);
      }
    }
  };

  // Handle proceed to payment
  const handleProceedToPayment = () => {
    if (eventData && eventData.availableTickets > 0) {
      localStorage.setItem("selectedTickets", selectedTickets.toString());
      navigate("/customer/payment");
    } else {
      setMessage("No tickets available to purchase.");
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-800 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading boat ride availability...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">WavePass Boat Rides</h1>
          <p className="text-gray-400 text-sm">Real-time concurrent ticketing availability</p>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-red-900/80 border border-red-500 rounded text-red-200 text-sm text-center">
            {message}
          </div>
        )}

        {eventData ? (
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-400 text-sm">Event Date:</span>
                <span className="text-white font-semibold">{eventData.eventDate}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-400 text-sm">Ticket Price:</span>
                <span className="text-green-400 font-bold text-lg">LKR {eventData.ticketPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                <span className="text-gray-400 text-sm">Available Seats:</span>
                <span
                  className={`font-bold px-3 py-1 rounded text-sm ${
                    eventData.availableTickets > 0
                      ? "bg-green-900/60 text-green-300 border border-green-600"
                      : "bg-red-900/60 text-red-300 border border-red-600"
                  }`}
                >
                  {eventData.availableTickets} / {eventData.maxTicketCapacity}
                </span>
              </div>
            </div>

            {/* Selection Form */}
            {eventData.availableTickets > 0 ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="ticketQuantity" className="block text-gray-300 text-sm font-medium mb-2">
                    Quantity:
                  </label>
                  <input
                    type="number"
                    id="ticketQuantity"
                    min="1"
                    max={eventData.availableTickets}
                    value={selectedTickets}
                    onChange={handleTicketChange}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-gray-400 text-xs mt-1">
                    Total: LKR {(selectedTickets * eventData.ticketPrice).toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={handleProceedToPayment}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                >
                  Proceed to Checkout
                </button>
              </div>
            ) : (
              <div className="text-center py-4 bg-gray-800/60 border border-gray-700 rounded-lg text-amber-300 text-sm">
                ⚠️ All tickets currently sold out. Vendors release tickets periodically.
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-400">No event data currently available.</div>
        )}
      </div>
    </div>
  );
};

export default TicketDisplay;
