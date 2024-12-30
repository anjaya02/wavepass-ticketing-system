import React, { useState, FormEvent } from "react";
import Modal from "./Modal";

interface ConfigurationFormProps {
  onClose: () => void;
}

interface ServerError {
  msg: string;
}

interface ConfigResponse {
  message?: string;
  errors?: ServerError[];
}

const ConfigurationForm: React.FC<ConfigurationFormProps> = ({ onClose }) => {
  // State variables for form fields
  const [totalTickets, setTotalTickets] = useState<number | ''>(500);
  const [ticketReleaseRate, setTicketReleaseRate] = useState<number | ''>(10000);
  const [customerRetrievalRate, setCustomerRetrievalRate] = useState<number | ''>(15000);
  const [maxTicketCapacity, setMaxTicketCapacity] = useState<number | ''>(200);

  // State for handling errors
  const [errors, setErrors] = useState<{
    totalTickets?: string;
    ticketReleaseRate?: string;
    customerRetrievalRate?: string;
    maxTicketCapacity?: string;
    general?: string;
  }>({});

  // State for handling loading
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // State for handling modal messages
  const [modalMessage, setModalMessage] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Handle input changes
  const handleTotalTicketsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setTotalTickets('');
    } else {
      const parsedValue = parseInt(value, 10);
      if (!isNaN(parsedValue)) {
        setTotalTickets(parsedValue);
      }
    }
  };

  const handleTicketReleaseRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setTicketReleaseRate('');
    } else {
      const parsedValue = parseInt(value, 10);
      if (!isNaN(parsedValue)) {
        setTicketReleaseRate(parsedValue);
      }
    }
  };

  const handleCustomerRetrievalRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setCustomerRetrievalRate('');
    } else {
      const parsedValue = parseInt(value, 10);
      if (!isNaN(parsedValue)) {
        setCustomerRetrievalRate(parsedValue);
      }
    }
  };

  const handleMaxTicketCapacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setMaxTicketCapacity('');
    } else {
      const parsedValue = parseInt(value, 10);
      if (!isNaN(parsedValue)) {
        setMaxTicketCapacity(parsedValue);
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationErrors: {
      totalTickets?: string;
      ticketReleaseRate?: string;
      customerRetrievalRate?: string;
      maxTicketCapacity?: string;
    } = {};

    // Validation
    if (totalTickets === '' || totalTickets <= 0) {
      validationErrors.totalTickets = "Total Tickets must be a positive number.";
    }

    if (ticketReleaseRate === '' || ticketReleaseRate <= 0) {
      validationErrors.ticketReleaseRate = "Ticket Release Rate must be a positive number.";
    }

    if (customerRetrievalRate === '' || customerRetrievalRate <= 0) {
      validationErrors.customerRetrievalRate = "Customer Retrieval Rate must be a positive number.";
    }

    if (maxTicketCapacity === '' || maxTicketCapacity <= 0) {
      validationErrors.maxTicketCapacity = "Max Ticket Capacity must be a positive number.";
    }

    if (
      totalTickets !== '' &&
      maxTicketCapacity !== '' &&
      maxTicketCapacity >= totalTickets
    ) {
      validationErrors.maxTicketCapacity = "Max Ticket Capacity must be less than Total Tickets.";
    }

    setErrors(validationErrors);

    // If no errors, send data to backend
    if (Object.keys(validationErrors).length === 0) {
      setIsLoading(true);
      try {
        const response = await fetch("http://localhost:5000/api/config/set", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            totalTickets,
            ticketReleaseRate,
            customerRetrievalRate,
            maxTicketCapacity,
          }),
        });

        const data: ConfigResponse = await response.json();

        if (!response.ok) {
          const errorMessages = data.errors
            ? data.errors.map((err: ServerError) => err.msg).join(", ")
            : data.message || "Failed to set configurations.";
          throw new Error(errorMessages);
        }

        setModalMessage("Configurations have been set successfully!");
        setIsModalOpen(true);
      } catch (error: unknown) {
        if (error instanceof Error) {
          setModalMessage(error.message);
        } else {
          setModalMessage("An unexpected error occurred.");
        }
        setIsModalOpen(true);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Modal>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 focus:outline-none"
          aria-label="Close Configuration Form"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-xl font-semibold mb-4 text-center">Set Configurations</h3>
        <form onSubmit={handleSubmit} noValidate>
          {/* Total Tickets */}
          <div className="mb-4">
            <label htmlFor="totalTickets" className="block text-gray-700 mb-2">
              Total Tickets:
            </label>
            <input
              type="number"
              id="totalTickets"
              name="totalTickets"
              value={totalTickets === '' ? '' : totalTickets}
              onChange={handleTotalTicketsChange}
              className={`w-full px-3 py-2 border ${
                errors.totalTickets ? "border-red-500" : "border-gray-300"
              } rounded bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              required
            />
            {errors.totalTickets && <p className="text-red-500 text-sm mt-1">{errors.totalTickets}</p>}
          </div>

          {/* Ticket Release Rate */}
          <div className="mb-4">
            <label htmlFor="ticketReleaseRate" className="block text-gray-700 mb-2">
              Ticket Release Rate (ms):
            </label>
            <input
              type="number"
              id="ticketReleaseRate"
              name="ticketReleaseRate"
              value={ticketReleaseRate === '' ? '' : ticketReleaseRate}
              onChange={handleTicketReleaseRateChange}
              className={`w-full px-3 py-2 border ${
                errors.ticketReleaseRate ? "border-red-500" : "border-gray-300"
              } rounded bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              required
            />
            {errors.ticketReleaseRate && (
              <p className="text-red-500 text-sm mt-1">{errors.ticketReleaseRate}</p>
            )}
          </div>

          {/* Customer Retrieval Rate */}
          <div className="mb-4">
            <label htmlFor="customerRetrievalRate" className="block text-gray-700 mb-2">
              Customer Retrieval Rate (ms):
            </label>
            <input
              type="number"
              id="customerRetrievalRate"
              name="customerRetrievalRate"
              value={customerRetrievalRate === '' ? '' : customerRetrievalRate}
              onChange={handleCustomerRetrievalRateChange}
              className={`w-full px-3 py-2 border ${
                errors.customerRetrievalRate ? "border-red-500" : "border-gray-300"
              } rounded bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              required
            />
            {errors.customerRetrievalRate && (
              <p className="text-red-500 text-sm mt-1">{errors.customerRetrievalRate}</p>
            )}
          </div>

          {/* Max Ticket Capacity */}
          <div className="mb-6">
            <label htmlFor="maxTicketCapacity" className="block text-gray-700 mb-2">
              Max Ticket Capacity:
            </label>
            <input
              type="number"
              id="maxTicketCapacity"
              name="maxTicketCapacity"
              value={maxTicketCapacity === '' ? '' : maxTicketCapacity}
              onChange={handleMaxTicketCapacityChange}
              className={`w-full px-3 py-2 border ${
                errors.maxTicketCapacity ? "border-red-500" : "border-gray-300"
              } rounded bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              required
            />
            {errors.maxTicketCapacity && (
              <p className="text-red-500 text-sm mt-1">{errors.maxTicketCapacity}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200 ${
                isLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isLoading ? "Saving..." : "Save Configurations"}
            </button>
          </div>
        </form>
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
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-xl font-semibold mb-4">Notification</h3>
            <p className="text-gray-700">{modalMessage}</p>
          </div>
        </Modal>
      )}
    </Modal>
  );
};

export default ConfigurationForm;
