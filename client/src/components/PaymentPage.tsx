import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "./Modal";
import api from "../services/api";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";

// Define the Ticket interface
interface Ticket {
  id: string;
  ticketId?: string;
  price: number;
  eventName: string;
  eventDate: string;
}

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const { authToken, customerId } = useContext(AuthContext);

  // States for customer details, tickets, card details, and modal visibility
  const [customerName, setCustomerName] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [numberOfTickets, setNumberOfTickets] = useState<number>(1);
  const [cardNumber, setCardNumber] = useState<string>("4000123456789010"); // Default simulated test card
  const [error, setError] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCustomerLoading, setIsCustomerLoading] = useState<boolean>(true);

  // States for ticket retrieval
  const [purchasedTickets, setPurchasedTickets] = useState<Ticket[]>([]);

  // Define ticket price as a constant
  const ticketPrice: number = 2800;
  const totalAmount: number = numberOfTickets * ticketPrice;

  // Fetch customer details
  useEffect(() => {
    const fetchCustomerDetails = async () => {
      if (authToken && customerId) {
        try {
          const response = await api.get(`/customers/${customerId}`);
          if (response.data && response.data.customer) {
            setCustomerName(response.data.customer.name);
            setCustomerEmail(response.data.customer.email);
          } else {
            setError("Invalid customer data received.");
          }
        } catch (err: unknown) {
          console.error("Error fetching customer details:", err);
          setError("Failed to fetch customer profile.");
        } finally {
          setIsCustomerLoading(false);
        }
      } else {
        navigate("/customer/login");
      }
    };

    fetchCustomerDetails();

    const storedTickets = parseInt(
      localStorage.getItem("selectedTickets") || "1",
      10
    );
    setNumberOfTickets(storedTickets > 0 ? storedTickets : 1);
  }, [authToken, customerId, navigate]);

  // Handle card number input change
  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // Keep only digits
    if (value.length <= 16) {
      setCardNumber(value);
    }
  };

  // Handle form submission (Simulated payment flow)
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate 16-digit card format for simulated validation
    if (cardNumber.length !== 16) {
      setError("Please enter a valid 16-digit card number.");
      setIsLoading(false);
      return;
    }

    try {
      if (!authToken || !customerId) {
        setError("Authentication required. Please log in again.");
        navigate("/customer/login");
        return;
      }

      // Execute synchronous purchase through atomic backend
      const response = await api.post(`/customers/${customerId}/purchase`, {
        quantity: numberOfTickets,
      });

      const tickets = response.data.purchasedTickets || response.data.data?.purchasedTickets || [];
      if (tickets.length > 0) {
        setPurchasedTickets(tickets);
        setIsModalOpen(true);
      } else {
        setError("Tickets could not be allocated. The pool may be sold out.");
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const errorMsg =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          "An error occurred during ticket purchase.";
        setError(errorMsg);
      } else {
        setError("An unexpected error occurred during ticket purchase.");
      }
    } finally {
      setIsLoading(false);
    }
  };


  // Handle modal actions
  const handleGoHome = () => {
    setIsModalOpen(false);
    navigate("/");
  };

  const handleViewTickets = () => {
    setIsModalOpen(false);
    navigate("/customer/purchasedTickets");
  };

  // Close modal on Esc key press
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
    <div className="flex items-center justify-center min-h-screen bg-gray-800 px-4 py-8">
      <div className="w-full max-w-md bg-gray-900 p-8 rounded-lg shadow-xl border border-gray-700">
        <h2 className="text-2xl font-bold text-center text-white mb-4">
          Complete Purchase
        </h2>

        {/* Demo payment notice */}
        <div className="mb-6 p-3 bg-amber-950/60 border border-amber-500/50 rounded-lg text-amber-200 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold uppercase tracking-wider text-amber-400">
              ⚡ Simulated Payment Flow
            </span>
          </div>
          <p className="text-amber-300/80 leading-relaxed">
            This checkout simulates payment for demonstration purposes. No real financial transaction occurs, and no card information is stored.
          </p>
        </div>

        {/* Customer & Order Summary */}
        <div className="mb-4 bg-gray-800 p-4 rounded-lg border border-gray-700 space-y-2 text-sm">
          <div className="flex justify-between text-gray-300">
            <span className="text-gray-400">Customer:</span>
            <span className="font-medium text-white">{isCustomerLoading ? "Loading..." : customerName}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span className="text-gray-400">Email:</span>
            <span className="font-medium text-white">{isCustomerLoading ? "Loading..." : customerEmail}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span className="text-gray-400">Ticket Quantity:</span>
            <span className="font-semibold text-blue-400">{numberOfTickets}</span>
          </div>
          <div className="border-t border-gray-700 pt-2 flex justify-between text-base font-semibold">
            <span className="text-gray-300">Total Amount:</span>
            <span className="text-green-400">LKR {totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="cardNumber" className="block text-gray-300 mb-2 font-medium text-sm">
              Card Number (16 Digits):
            </label>
            <input
              type="text"
              id="cardNumber"
              name="cardNumber"
              value={cardNumber}
              onChange={handleCardChange}
              maxLength={16}
              placeholder="4000 1234 5678 9010"
              className="w-full px-3 py-2 border border-gray-700 rounded bg-gray-700 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-gray-400 text-xs mt-1">
              Pre-filled with dummy card number for immediate testing.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 text-center text-sm p-3 rounded bg-red-900/80 border border-red-500 text-red-200">
              {error}
            </div>
          )}

          {/* Pay Button */}
          <button
            type="submit"
            className={`w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md ${
              isLoading ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={isLoading}
          >
            {isLoading ? "Allocating Tickets..." : `Confirm & Pay LKR ${totalAmount.toLocaleString()}`}
          </button>
        </form>
      </div>

      {/* Success Modal */}
      {isModalOpen && (
        <Modal>
          <div className="bg-gray-900 border border-gray-700 text-white rounded-lg shadow-2xl p-6 max-w-lg mx-auto relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white focus:outline-none"
              aria-label="Close Modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-xl">
                ✓
              </div>
              <h3 className="text-xl font-bold text-white">Purchase Successful!</h3>
            </div>

            <p className="text-gray-300 text-sm mb-4">
              Your tickets have been atomically allocated and confirmed. Here are your ticket details:
            </p>

            {/* Scrollable Ticket List */}
            <div className="mb-6 bg-gray-800 rounded-lg p-3 border border-gray-700 max-h-60 overflow-y-auto">
              <ul className="space-y-2">
                {purchasedTickets.map((ticket, index) => (
                  <li key={ticket.id || index} className="text-xs py-2 px-3 bg-gray-700/60 rounded border border-gray-600 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-blue-300">Ticket #{index + 1}</span>
                      <p className="text-gray-400 font-mono text-[11px]">ID: {ticket.id || ticket.ticketId}</p>
                    </div>
                    <span className="font-semibold text-green-400">LKR {ticket.price ? ticket.price.toLocaleString() : "2,800"}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleGoHome}
                className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 text-sm font-medium transition-colors"
              >
                Go to Home
              </button>
              <button
                onClick={handleViewTickets}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
              >
                View My Tickets
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PaymentPage;
