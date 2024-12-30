import React, { useEffect, useReducer, useCallback, useRef } from "react";
import { Pie } from "react-chartjs-2";
import Modal from "./Modal";
import { Chart, ArcElement, Tooltip, Legend } from "chart.js";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import socketEvents from "../utils/socketEvents";
import {
  InitialData,
  TicketUpdate,
  VendorReleasedTickets,
  PurchaseSuccess,
  PurchaseFailure,
  TicketRefunded,
  SystemStatus,
  ConfigurationData,
} from "../types/types";

import {
  fetchTotalReleasedTickets,
  fetchSoldTickets,
  fetchReleasedTickets,
} from "../services/api";

// Register Chart.js components
Chart.register(ArcElement, Tooltip, Legend);

interface LogEntry {
  id: number;
  message: string;
  timestamp: string;
}

// Reducer and state definitions
interface State {
  availableTickets: number;
  soldTickets: number;
  vendorReleasedTickets: number;
  maxCapacity: number;
  totalReleasedTickets: number;
}

type Action =
  | { type: 'SET_INITIAL_DATA'; payload: InitialData }
  | { type: 'UPDATE_AVAILABLE_TICKETS'; payload: number }
  | { type: 'UPDATE_SOLD_TICKETS'; payload: number }
  | { type: 'UPDATE_VENDOR_RELEASED_TICKETS'; payload: number }
  | { type: 'SET_MAX_CAPACITY'; payload: number }
  | { type: 'SET_TOTAL_RELEASED_TICKETS'; payload: number }
  | { type: 'RESET_VENDOR_RELEASED_TICKETS' };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_INITIAL_DATA':
      return {
        ...state,
        availableTickets: action.payload.availableTickets,
        soldTickets: 0,
        vendorReleasedTickets: 0,
      };
    case 'UPDATE_AVAILABLE_TICKETS':
      return {
        ...state,
        availableTickets: action.payload,
      };
    case 'UPDATE_SOLD_TICKETS':
      return {
        ...state,
        soldTickets: state.soldTickets + action.payload,
      };
    case 'UPDATE_VENDOR_RELEASED_TICKETS':
      return {
        ...state,
        vendorReleasedTickets: state.vendorReleasedTickets + action.payload,
      };
    case 'SET_MAX_CAPACITY':
      return {
        ...state,
        maxCapacity: action.payload,
      };
    case 'SET_TOTAL_RELEASED_TICKETS':
      return {
        ...state,
        totalReleasedTickets: action.payload,
      };
    case 'RESET_VENDOR_RELEASED_TICKETS':
      return {
        ...state,
        vendorReleasedTickets: 0,
      };
    default:
      return state;
  }
};

// Memoized Modal Content for Logs 
const LogsModalContent = React.memo(
  ({
    selectedLog,
    onClose,
  }: {
    selectedLog: LogEntry;
    onClose: () => void;
  }) => (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-600 hover:text-gray-800 focus:outline-none"
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
      <h3 className="text-2xl font-semibold mb-4">Log Details</h3>
      <p className="text-gray-700 mb-2">
        <span className="font-medium">Timestamp:</span> {selectedLog.timestamp}
      </p>
      <p className="text-gray-700">
        <span className="font-medium">Message:</span> {selectedLog.message}
      </p>
    </div>
  )
);

const VendorDashboard: React.FC = () => {
  // Initialize reducer
  const initialState: State = {
    availableTickets: 0,
    soldTickets: 0,
    vendorReleasedTickets: 0,
    maxCapacity: 200,
    totalReleasedTickets: 0,
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  // State to manage logs
  const [logs, setLogs] = React.useState<LogEntry[]>([]);

  // State to manage selected log for detailed view
  const [selectedLog, setSelectedLog] = React.useState<LogEntry | null>(null);

  // State to manage loading status
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Hook for navigation
  const navigate = useNavigate();

  // Hook to access socket
  const { socket } = useSocket();

  // Ref to track processed event IDs
  const processedTicketIdsRef = useRef<Set<string>>(new Set());

  // Compute the gap (free space) based on sold and released tickets
  const gap = Math.max(
    state.maxCapacity - state.soldTickets - state.totalReleasedTickets,
    0
  );

  // Helper function to retrieve token from localStorage
  const getToken = useCallback(() => {
    return localStorage.getItem("authToken");
  }, []);

  // Load logs from localStorage on component mount
  useEffect(() => {
    const storedLogs = localStorage.getItem("vendorLogs");
    if (storedLogs) {
      setLogs(JSON.parse(storedLogs));
    }
  }, []);

  const addLog = useCallback((message: string) => {
    setLogs((prevLogs) => {
      const newLog: LogEntry = {
        id: prevLogs.length > 0 ? prevLogs[0].id + 1 : 1, // Increment ID
        message,
        timestamp: new Date().toLocaleTimeString(),
      };
      const updatedLogs = [newLog, ...prevLogs];
      localStorage.setItem("vendorLogs", JSON.stringify(updatedLogs));
      return updatedLogs;
    });
  }, []);

  // Function to fetch total released tickets across all vendors
  const fetchTotalReleasedTicketsCount = useCallback(async () => {
    try {
      const totalReleased = await fetchTotalReleasedTickets();
      dispatch({ type: 'SET_TOTAL_RELEASED_TICKETS', payload: totalReleased });
    } catch (error: unknown) {
      if (error instanceof Error) {
        addLog(error.message);
      } else {
        console.error(
          "An unexpected error occurred while fetching total released tickets."
        );
        addLog("An unexpected error occurred.");
      }
    }
  }, [addLog]);

  // Define socket event handlers using useCallback to prevent re-creation
  const handleInitialData = useCallback(
    (data: InitialData) => {
      dispatch({ type: 'SET_INITIAL_DATA', payload: data });
      addLog(`Initial data received: ${data.availableTickets} tickets available.`);
      setIsLoading(false);
    },
    [addLog]
  );

  const handleTicketUpdate = useCallback(
    (data: TicketUpdate) => {
      dispatch({ type: 'UPDATE_AVAILABLE_TICKETS', payload: data.availableTickets });
      addLog(`Tickets updated: ${data.availableTickets} available.`);
    },
    [addLog]
  );

  const handleVendorReleasedTickets = useCallback(
    (data: VendorReleasedTickets) => {
      dispatch({ type: 'UPDATE_VENDOR_RELEASED_TICKETS', payload: data.quantity });
      dispatch({ type: 'UPDATE_AVAILABLE_TICKETS', payload: data.availableTickets });
      addLog(data.message);
      fetchTotalReleasedTicketsCount();
    },
    [addLog, fetchTotalReleasedTicketsCount]
  );

  const handlePurchaseSuccess = useCallback(
    (data: PurchaseSuccess) => {
      console.log("Received PURCHASE_SUCCESS:", data);
      const numPurchased = data.ticketIds.length;

      dispatch({ type: 'UPDATE_AVAILABLE_TICKETS', payload: data.availableTickets });
      dispatch({ type: 'UPDATE_SOLD_TICKETS', payload: numPurchased });
      dispatch({ type: 'UPDATE_VENDOR_RELEASED_TICKETS', payload: -numPurchased });

      fetchTotalReleasedTicketsCount();

      addLog(`${numPurchased} tickets sold.`);
    },
    [addLog, fetchTotalReleasedTicketsCount]
  );

  const handlePurchaseFailure = useCallback(
    (data: PurchaseFailure) => {
      console.log("Received PURCHASE_FAILURE:", data);
      addLog(`Purchase failed: ${data.message}`);
    },
    [addLog]
  );

  const handleTicketRefunded = useCallback(
    (data: TicketRefunded) => {
      dispatch({ type: 'UPDATE_AVAILABLE_TICKETS', payload: state.availableTickets + 1 });
      dispatch({ type: 'UPDATE_SOLD_TICKETS', payload: -1 });
      addLog(`Ticket refunded: ${data.message}`);
      fetchTotalReleasedTicketsCount();
      processedTicketIdsRef.current.delete(data.ticketId);
    },
    [addLog, fetchTotalReleasedTicketsCount, state.availableTickets]
  );

  const handleSystemStatus = useCallback(
    (data: SystemStatus) => {
      addLog(`System Status: ${data.message}`);
    },
    [addLog]
  );

  const handleTicketSold = useCallback(
    (data: { ticketId: string; availableTickets: number; message: string }) => {
      console.log("Received ticketSold event:", data);

      if (processedTicketIdsRef.current.has(data.ticketId)) {
        console.warn(
          `Duplicate ticketSold event with ticketId: ${data.ticketId}`
        );
        return;
      }

      dispatch({ type: 'UPDATE_AVAILABLE_TICKETS', payload: data.availableTickets });
      dispatch({ type: 'UPDATE_SOLD_TICKETS', payload: 1 });
      dispatch({ type: 'SET_TOTAL_RELEASED_TICKETS', payload: Math.max(state.totalReleasedTickets - 1, 0) });

      addLog(data.message);

      processedTicketIdsRef.current.add(data.ticketId);
    },
    [addLog, state.totalReleasedTickets]
  );

  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("connect", () => {
      console.log("Socket connected with ID:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected.");
    });

    socket.on(socketEvents.INITIAL_DATA, handleInitialData);
    socket.on(socketEvents.TICKET_UPDATE, handleTicketUpdate);
    socket.on(socketEvents.VENDOR_RELEASED_TICKETS, handleVendorReleasedTickets);
    socket.on(socketEvents.PURCHASE_SUCCESS, handlePurchaseSuccess);
    socket.on(socketEvents.PURCHASE_FAILURE, handlePurchaseFailure);
    socket.on(socketEvents.TICKET_REFUNDED, handleTicketRefunded);
    socket.on(socketEvents.SYSTEM_STATUS, handleSystemStatus);
    socket.on(socketEvents.TICKET_SOLD, handleTicketSold);

    // Cleanup listeners on unmount
    return () => {
      socket.off(socketEvents.INITIAL_DATA, handleInitialData);
      socket.off(socketEvents.TICKET_UPDATE, handleTicketUpdate);
      socket.off(socketEvents.VENDOR_RELEASED_TICKETS, handleVendorReleasedTickets);
      socket.off(socketEvents.PURCHASE_SUCCESS, handlePurchaseSuccess);
      socket.off(socketEvents.PURCHASE_FAILURE, handlePurchaseFailure);
      socket.off(socketEvents.TICKET_REFUNDED, handleTicketRefunded);
      socket.off(socketEvents.SYSTEM_STATUS, handleSystemStatus);
      socket.off(socketEvents.TICKET_SOLD, handleTicketSold);
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [
    socket,
    handleInitialData,
    handleTicketUpdate,
    handleVendorReleasedTickets,
    handlePurchaseSuccess,
    handlePurchaseFailure,
    handleTicketRefunded,
    handleSystemStatus,
    handleTicketSold,
  ]);

  // Fetch initial data on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const token = getToken();
        if (!token) {
          addLog("Your session has expired. Please log in again.");
          navigate("/vendor/login", { replace: true });
          return;
        }

        // Fetch Configuration
        const configResponse = await fetch(
          `${
            import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
          }/config/`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (configResponse.ok) {
          const config: ConfigurationData = await configResponse.json();
          dispatch({ type: 'SET_MAX_CAPACITY', payload: config.maxTicketCapacity });
        } else if (configResponse.status === 404) {
          // No existing configuration; handle accordingly
          console.warn(
            "No existing configuration found. Using default maxCapacity."
          );
          dispatch({ type: 'SET_MAX_CAPACITY', payload: 200 }); // Default or prompt user to set
        } else {
          const data = await configResponse.json();
          throw new Error(data.message || "Failed to fetch configurations.");
        }

        // Fetch Sold Tickets
        const soldTickets = await fetchSoldTickets();
        dispatch({ type: 'UPDATE_SOLD_TICKETS', payload: soldTickets });

        // Fetch Released Tickets
        const releasedTickets = await fetchReleasedTickets();
        dispatch({ type: 'UPDATE_VENDOR_RELEASED_TICKETS', payload: releasedTickets });

        // Fetch Total Released Tickets
        const totalReleased = await fetchTotalReleasedTickets();
        dispatch({ type: 'SET_TOTAL_RELEASED_TICKETS', payload: totalReleased });

        setIsLoading(false); // Data fetched
      } catch (error: unknown) {
        if (error instanceof Error) {
          addLog(error.message);
        } else {
          console.error(
            "An unexpected error occurred while fetching initial data."
          );
          addLog("An unexpected error occurred.");
        }
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [getToken, navigate, addLog]);

  // Prepare Pie Chart Data
  const pieChartData = {
    labels: [
      "Sold Tickets",
      "Released Tickets/Available for Purchase",
      "Free Space",
    ],
    datasets: [
      {
        label: "# of Tickets",
        data: [state.soldTickets, state.totalReleasedTickets, gap],
        backgroundColor: [
          "rgba(231, 76, 60, 0.8)", // Red for Sold Tickets
          "rgba(52, 152, 219, 0.8)", // Blue for Released Tickets/Available for Purchase
          "rgba(46, 204, 113, 0.8)", // Green for Free Space
        ],
        borderColor: [
          "rgba(231, 76, 60, 1)",
          "rgba(52, 152, 219, 1)",
          "rgba(46, 204, 113, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  useEffect(() => {
    console.log("Current state:", state);
  }, [state]);

  return (
    <div className="min-h-screen bg-gray-800 p-4">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-white text-xl">Loading dashboard...</p>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto bg-gray-900 rounded-lg shadow-lg p-4 md:p-6">
          <h1 className="text-3xl font-bold text-white mb-6 text-center">
            Vendor Dashboard
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pie Chart */}
            <div className="bg-gray-800 p-4 rounded-lg flex flex-col items-center justify-center">
              <h2 className="text-xl font-semibold text-white mb-4">
                Tickets Overview
              </h2>
              <Pie data={pieChartData} />
              <div className="mt-4 text-gray-300">
                <p>
                  <strong>Max Capacity:</strong> {state.maxCapacity}
                </p>
                <p>
                  <strong>Sold Tickets:</strong> {state.soldTickets}
                </p>
                <p>
                  <strong>Released Tickets/Available for Purchase:</strong>{" "}
                  {state.totalReleasedTickets}
                </p>
                <p>
                  <strong>Free Space:</strong> {gap}
                </p>
              </div>
            </div>

            {/* Live Logs */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-semibold text-white mb-4">
                Live Logs
              </h2>
              <div className="h-64 md:h-72 overflow-y-auto">
                <ul className="space-y-2">
                  {logs.length > 0 ? (
                    logs.map((log) => (
                      <li
                        key={log.id}
                        className="bg-gray-700 p-2 rounded hover:bg-gray-600 cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <span className="text-sm text-gray-300">
                          {log.timestamp}:
                        </span>{" "}
                        <span className="text-white">{log.message}</span>
                      </li>
                    ))
                  ) : (
                    <p className="text-gray-400">No logs available.</p>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Detailed Log Modal */}
          {selectedLog && (
            <Modal>
              <LogsModalContent
                selectedLog={selectedLog}
                onClose={() => setSelectedLog(null)}
              />
            </Modal>
          )}
        </div>
      )}
    </div>
  );
};

export default VendorDashboard;
