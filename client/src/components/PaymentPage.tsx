import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "./Modal";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

// Define the Ticket interface
interface Ticket {
  id: string;
  ticketId: string;
  price: number;
  eventName: string;
  eventDate: string;
}

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const { authToken, customerId } = useContext(AuthContext);
  const { socket } = useSocket();

  // States for customer details, tickets, card details, and modal visibility
  const [customerName, setCustomerName] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [numberOfTickets, setNumberOfTickets] = useState<number>(1);
  const [cardNumber, setCardNumber] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCustomerLoading, setIsCustomerLoading] = useState<boolean>(true);

  // New states for ticket retrieval
  const [purchasedTickets, setPurchasedTickets] = useState<Ticket[]>([]);
  const [ticketsRetrieved, setTicketsRetrieved] = useState<number>(0);
  const [isRetrievingTickets, setIsRetrievingTickets] = useState<boolean>(false);
  const [customerRetrievalRate, setCustomerRetrievalRate] = useState<number>(1000); 

  // Define ticket price as a constant
  const ticketPrice: number = 2800;

  // Compute total amount based on number of tickets
  const totalAmount: number = numberOfTickets * ticketPrice;

  // Fetch customer details and retrieval rate
  useEffect(() => {
    const fetchCustomerDetails = async () => {
      if (authToken && customerId) {
        try {
          const response = await axios.get(
            `http://localhost:5000/api/customers/${customerId}`,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            }
          );

          if (response.data && response.data.customer) {
            setCustomerName(response.data.customer.name);
            setCustomerEmail(response.data.customer.email);
          } else {
            setError("Invalid customer data received.");
          }
        } catch (error: unknown) {
          if (axios.isAxiosError(error)) {
            console.error(
              "Error fetching customer details:",
              error.response?.data || error.message
            );
            setError("Failed to fetch customer details.");
          } else {
            console.error("Unexpected error:", error);
            setError("An unexpected error occurred.");
          }
        } finally {
          setIsCustomerLoading(false);
        }
      } else {
        setError("Authentication required. Please log in again.");
        navigate("/customer/login");
      }
    };

    const fetchRetrievalRate = async () => {
      try {
        const response = await axios.get(
          "http://localhost:5000/api/config/customer-retrieval-rate"
        );
        if (response.data && response.data.customerRetrievalRate) {
          setCustomerRetrievalRate(response.data.customerRetrievalRate);
        }
      } catch (error) {
        console.error("Error fetching customer retrieval rate:", error);
        // Set default retrieval rate if error occurs
        setCustomerRetrievalRate(1000);
      }
    };

    fetchCustomerDetails();
    fetchRetrievalRate();

    const storedTickets = parseInt(
      localStorage.getItem("selectedTickets") || "1",
      10
    );
    setNumberOfTickets(storedTickets);
  }, [authToken, customerId, navigate]);

  // Handle card number input change
  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, ""); // Remove spaces
    if (/^\d{0,16}$/.test(value)) {
      setCardNumber(value);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate card number
    if (cardNumber.length !== 16) {
      setError("Card number must be exactly 16 digits.");
      setIsLoading(false);
      return;
    }
    try {
      if (!authToken || !customerId) {
        setError("Authentication required. Please log in again.");
        navigate("/customer/login");
        setIsLoading(false);
        return;
      }

      // Prepare API request
      const apiUrl = `http://localhost:5000/api/customers/${customerId}/purchase`;

      // Make the API call without assigning the response to a variable
      await axios.post(
        apiUrl,
        { quantity: numberOfTickets },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      // Start ticket retrieval process
      setIsRetrievingTickets(true);
      setPurchasedTickets([]); // Reset purchased tickets
      setTicketsRetrieved(0); // Reset tickets retrieved
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error("Purchase error:", error.response?.data || error.message);
        setError(
          error.response?.data?.message ||
            "An error occurred during ticket purchase."
        );
      } else {
        console.error("Unexpected error:", error);
        setError("An unexpected error occurred during ticket purchase.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for ticket events from the backend
  useEffect(() => {
    if (!socket || !customerId) {
      return;
    }

    const handleTicketRetrieved = (data: { ticket: Ticket }) => {
      setPurchasedTickets((prevTickets) => [...prevTickets, data.ticket]);
      setTicketsRetrieved((prevCount) => prevCount + 1);
    };

    const handlePurchaseComplete = () => {
      setIsRetrievingTickets(false);
      setIsModalOpen(true);
    };

    const handleError = (data: { message: string }) => {
      setError(data.message || "An error occurred during ticket retrieval.");
      setIsRetrievingTickets(false);
    };

    socket.on("ticketRetrieved", handleTicketRetrieved);
    socket.on("purchaseComplete", handlePurchaseComplete);
    socket.on("purchaseError", handleError);

    // Cleanup listeners on unmount
    return () => {
      socket.off("ticketRetrieved", handleTicketRetrieved);
      socket.off("purchaseComplete", handlePurchaseComplete);
      socket.off("purchaseError", handleError);
    };
  }, [socket, customerId]);

  // Handle modal actions
  const handleGoHome = () => {
    setIsModalOpen(false);
    navigate("/");
  };

  const handleViewTickets = () => {
    setIsModalOpen(false);
    navigate("/customer/purchasedTickets");
  };

  // Optional: Close modal on Esc key press
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800 px-4">
      <div className="w-full max-w-md bg-gray-900 p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-center text-white mb-6">
          Purchase Tickets
        </h2>

        {/* Customer Details */}
        <div className="mb-4">
          <p className="text-gray-300">
            <span className="font-medium">Name:</span>{" "}
            {isCustomerLoading ? "Loading..." : customerName}
          </p>
          <p className="text-gray-300">
            <span className="font-medium">Email:</span>{" "}
            {isCustomerLoading ? "Loading..." : customerEmail}
          </p>
          <p className="text-gray-300">
            <span className="font-medium">Number of Tickets:</span>{" "}
            {numberOfTickets}
          </p>
        </div>

        {/* Total Amount */}
        <div className="mb-6">
          <p className="text-gray-300">
            <span className="font-medium">Total Amount:</span> LKR{" "}
            {totalAmount.toLocaleString()}
          </p>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Card Number */}
          <div className="mb-4">
            <label
              htmlFor="cardNumber"
              className="block text-gray-300 mb-2 font-medium"
            >
              Card Number:
            </label>
            <input
              type="text"
              id="cardNumber"
              name="cardNumber"
              value={cardNumber}
              onChange={handleCardChange}
              maxLength={16}
              placeholder="Enter 16-digit card number"
              className="w-full px-3 py-2 border border-gray-700 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-gray-400 text-sm mt-1">
              Please enter a valid 16-digit card number.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 text-center text-sm p-2 rounded bg-red-500 text-white">
              {error}
            </div>
          )}

          {/* Pay Button */}
          <button
            type="submit"
            className={`w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition-colors ${
              isLoading ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={isLoading}
          >
            {isLoading
              ? "Processing..."
              : `Pay LKR ${totalAmount.toLocaleString()}`}
          </button>
        </form>

        {/* Ticket Retrieval Progress */}
        {isRetrievingTickets && (
          <div className="mt-6 text-center text-white">
            <p>
              Retrieving tickets: {ticketsRetrieved} / {numberOfTickets}
            </p>
            <p>
              Retrieval Rate: {customerRetrievalRate / 1000} seconds per ticket
            </p>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {isModalOpen && (
        <Modal>
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg mx-auto relative">
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Close Modal"
            >
              {/* SVG Icon for "X" */}
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

            <h3 className="text-xl font-semibold mb-4">Payment Successful!</h3>
            <p className="mb-6">
              Your tickets have been purchased successfully. Here are your ticket
              details:
            </p>

            {/* Scrollable Ticket List */}
            <div className="mb-6">
              <ul className="max-h-60 overflow-y-auto px-2">
                {purchasedTickets.map((ticket, index) => (
                  <li
                    key={ticket.id}
                    className="text-gray-700 py-1 border-b last:border-none"
                  >
                    <span className="font-medium">Ticket {index + 1}:</span> ID{" "}
                    {ticket.ticketId}, Price LKR {ticket.price.toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={handleGoHome}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Go to Home
              </button>
              <button
                onClick={handleViewTickets}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                View Tickets
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PaymentPage;
