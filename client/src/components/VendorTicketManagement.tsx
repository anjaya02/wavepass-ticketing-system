import React, { useState, useEffect, useCallback, memo } from "react";
import Modal from "./Modal";
import ConfigurationForm from "./ConfigurationForm";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import axios from "axios";

interface ConfigurationData {
  totalTickets: number;
  ticketReleaseRate: number;
  customerRetrievalRate: number;
  maxTicketCapacity: number;
}

interface TicketManagementData {
  maxCapacity: number;
  availableTickets: number;
  vendorReleasedTickets: number;
}

interface Ticket {
  _id: string;
  status: string;
  owner?: {
    _id: string;
  };
  vendor: string;
  price: number;
  eventName: string;
  eventDate: string; 
  createdAt: string;
  updatedAt: string;
}

// Memoized Modal Content for Tickets
const TicketsModalContent = memo(
  ({
    myTickets,
    loadingTickets,
    onClose,
  }: {
    myTickets: Ticket[];
    loadingTickets: boolean;
    onClose: () => void;
  }) => (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg relative">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 focus:outline-none"
        aria-label="Close Modal"
      >
        {/* Close Icon */}
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
      <h3 className="text-xl font-semibold mb-4">Your Tickets</h3>

      {loadingTickets ? (
        <p>Loading tickets...</p>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {myTickets.length > 0 ? (
            myTickets.map((ticket) => (
              <div key={ticket._id} className="border p-3 rounded">
                <p>
                  <strong>Ticket ID:</strong> {ticket._id}
                </p>
                <p>
                  <strong>Status:</strong> {ticket.status}
                </p>
                <p>
                  <strong>Price:</strong> LKR {ticket.price.toFixed(2)}
                </p>
                <p>
                  <strong>Event Name:</strong> {ticket.eventName}
                </p>
                <p>
                  <strong>Event Date:</strong>{" "}
                  {new Date(ticket.eventDate).toLocaleDateString()}
                </p>
                {ticket.status === "sold" && ticket.owner && (
                  <p>
                    <strong>Customer ID:</strong> {ticket.owner._id}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p>You have not released any tickets yet.</p>
          )}
        </div>
      )}
    </div>
  )
);

// Memoized Modal Content for Messages
const MessageModalContent = memo(
  ({
    modalMessage,
    onClose,
  }: {
    modalMessage: string;
    onClose: () => void;
  }) => (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm relative">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 focus:outline-none"
        aria-label="Close Modal"
      >
        {/* Close Icon */}
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
  )
);

const VendorTicketManagement: React.FC = () => {
  const [ticketData, setTicketData] = useState<TicketManagementData>({
    maxCapacity: 0,
    availableTickets: 0,
    vendorReleasedTickets: 0,
  });

  const [configuration, setConfiguration] = useState<ConfigurationData | null>(
    null
  );

  const [ticketsToRelease, setTicketsToRelease] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMessage, setModalMessage] = useState<string>("");

  const [isConfigFormOpen, setIsConfigFormOpen] = useState<boolean>(false);

  const [isTicketsModalOpen, setIsTicketsModalOpen] = useState<boolean>(false);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]); 
  const [loadingTickets, setLoadingTickets] = useState<boolean>(false);

  const navigate = useNavigate();

  // Fetch Configuration Function
  const fetchConfiguration = useCallback(async () => {
    try {
      const response = await api.get<ConfigurationData>("/config/");
      setConfiguration(response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setConfiguration(null);
        return;
      }
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : error instanceof Error
          ? error.message
          : "Failed to fetch configurations.";
      setModalMessage(message);
      setIsModalOpen(true);
    }
  }, []);

  // Fetch Ticket Data Function
  const fetchTicketData = useCallback(async () => {
    try {
      const response = await api.get<TicketManagementData>("/vendor/ticket-pool");
      setTicketData(response.data);
    } catch (error: unknown) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : error instanceof Error
          ? error.message
          : "Failed to fetch ticket data.";
      setModalMessage(message);
      setIsModalOpen(true);
    }
  }, []);

  // Fetch Configuration and Ticket Data on Component Mount
  useEffect(() => {
    fetchConfiguration();
    fetchTicketData();
  }, [fetchConfiguration, fetchTicketData]);

  // Compute maxTicketsToRelease safely
  const maxTicketsToRelease =
    configuration &&
    typeof configuration.maxTicketCapacity === "number" &&
    !isNaN(configuration.maxTicketCapacity) &&
    typeof ticketData.availableTickets === "number" &&
    !isNaN(ticketData.availableTickets)
      ? configuration.maxTicketCapacity - ticketData.availableTickets
      : undefined;

  // Handle releasing tickets
  const handleReleaseTickets = useCallback(async () => {
    if (ticketsToRelease <= 0) {
      setModalMessage("Please enter a valid number of tickets to add.");
      setIsModalOpen(true);
      return;
    }

    if (
      configuration &&
      ticketData.availableTickets + ticketsToRelease >
        configuration.maxTicketCapacity
    ) {
      setModalMessage(
        `Adding ${ticketsToRelease} tickets exceeds the maximum capacity of ${configuration.maxTicketCapacity}.`
      );
      setIsModalOpen(true);
      return;
    }

    try {
      const response = await api.post("/vendor/add-tickets", {
        ticketCount: ticketsToRelease,
      });

      // Refresh ticket data to reflect the latest state
      await fetchTicketData();

      setModalMessage(
        response.data?.message || `Successfully added ${ticketsToRelease} tickets to the pool.`
      );
      setIsModalOpen(true);
      setTicketsToRelease(0);
    } catch (error: unknown) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : error instanceof Error
          ? error.message
          : "Failed to add tickets.";
      setModalMessage(message);
      setIsModalOpen(true);
    }
  }, [
    ticketsToRelease,
    configuration,
    ticketData.availableTickets,
    fetchTicketData,
  ]);

  // Handle Viewing My Tickets
  const handleViewMyTickets = useCallback(async () => {
    try {
      setLoadingTickets(true);
      const response = await api.get<{ tickets: Ticket[] }>("/vendor/my-tickets");
      setMyTickets(response.data?.tickets || []);
      setIsTicketsModalOpen(true);
    } catch (error: unknown) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : error instanceof Error
          ? error.message
          : "Failed to fetch your tickets.";
      setModalMessage(message);
      setIsModalOpen(true);
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  // Handle Navigation Buttons
  const navigateToStartRelease = useCallback(() => {
    navigate("/vendor/start-release");
  }, [navigate]);

  const navigateToStopRelease = useCallback(() => {
    navigate("/vendor/stop-release");
  }, [navigate]);

  const navigateToDashboard = useCallback(() => {
    navigate("/vendor/dashboard");
  }, [navigate]);

  // Handle Opening Configuration Form
  const openConfigurationForm = useCallback(() => {
    setIsConfigFormOpen(true);
  }, []);

  const closeConfigurationForm = useCallback(() => {
    setIsConfigFormOpen(false);
    fetchConfiguration();
  }, [fetchConfiguration]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800 px-4 py-12">
      <div className="w-full max-w-lg bg-gray-900 p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-center text-white mb-6">
          Ticket Management
        </h2>

        <div className="space-y-4">
          {/* Display Available Tickets */}
          <div className="flex justify-between items-center">
            <span className="text-gray-300">
              Available tickets in the Pool:
            </span>
            <span className="text-white">
              {typeof ticketData.availableTickets === "number"
                ? `${ticketData.availableTickets} Tickets`
                : "N/A"}
            </span>
          </div>

          {/* Display Your Released Tickets */}
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Your Released Tickets:</span>
            <span className="text-white">
              {ticketData.vendorReleasedTickets} Tickets
            </span>
          </div>
          <div className="mt-2">
            <button
              onClick={handleViewMyTickets}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200"
            >
              View Tickets
            </button>
          </div>

          {/* Display Configuration Settings */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-300 mb-2">
              Configurations:
            </h3>
            {configuration ? (
              <div className="space-y-2">
                <p className="text-gray-400">
                  <strong>Total Tickets:</strong> {configuration.totalTickets}
                </p>
                <p className="text-gray-400">
                  <strong>Ticket Release Rate:</strong>{" "}
                  {configuration.ticketReleaseRate} ms
                </p>
                <p className="text-gray-400">
                  <strong>Customer Retrieval Rate:</strong>{" "}
                  {configuration.customerRetrievalRate} ms
                </p>
                <p className="text-gray-400">
                  <strong>Max Ticket Capacity:</strong>{" "}
                  {configuration.maxTicketCapacity}
                </p>
              </div>
            ) : (
              <p className="text-gray-400">No configurations set.</p>
            )}

            {/* Button to Open Configuration Form */}
            <button
              onClick={openConfigurationForm}
              className="mt-4 px-4 py-2 bg-yellow-500 text-white font-semibold rounded hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition duration-200"
            >
              {configuration ? "Update Configurations" : "Set Configurations"}
            </button>
          </div>

          {/* Input to Release Tickets */}
          <div className="flex flex-col mt-6">
            <label htmlFor="ticketsToRelease" className="text-gray-300 mb-1">
              Tickets to Be Added to the Ticket Pool:
            </label>
            {/* Replace max in input with maxTicketsToRelease */}
            <input
              type="number"
              id="ticketsToRelease"
              min="1"
              max={maxTicketsToRelease}
              value={ticketsToRelease}
              onChange={(e) => setTicketsToRelease(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter number of tickets"
            />
          </div>

          {/* Release Button */}
          <button
            onClick={handleReleaseTickets}
            className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition duration-200"
          >
            Add Tickets
          </button>

          {/* Divider */}
          <div className="border-t border-gray-600 my-6"></div>

          {/* Start, Stop Release and Dashboard Buttons */}
          <div className="flex flex-col space-y-4">
            <button
              onClick={navigateToStartRelease}
              className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200"
            >
              Start Release
            </button>
            <button
              onClick={navigateToStopRelease}
              className="w-full px-4 py-2 bg-red-600 text-white font-semibold rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition duration-200"
            >
              Stop Release
            </button>
            <button
              onClick={navigateToDashboard}
              className="w-full px-4 py-2 bg-gray-600 text-white font-semibold rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 transition duration-200"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Form Modal */}
      {isConfigFormOpen && (
        <ConfigurationForm onClose={closeConfigurationForm} />
      )}

      {/* Tickets Modal */}
      {isTicketsModalOpen && (
        <Modal onClose={() => setIsTicketsModalOpen(false)}>
          <TicketsModalContent
            myTickets={myTickets}
            loadingTickets={loadingTickets}
            onClose={() => setIsTicketsModalOpen(false)}
          />
        </Modal>
      )}

      {/* Modal for Messages */}
      {isModalOpen && (
        <Modal>
          <MessageModalContent
            modalMessage={modalMessage}
            onClose={() => setIsModalOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
};

export default VendorTicketManagement;
