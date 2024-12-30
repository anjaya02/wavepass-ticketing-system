import React, { useEffect, useState, useContext } from "react";
import { Ticket } from "../interfaces/Ticket";
import Modal from "./Modal";
import api from "../services/api";
import axios from "axios";
import { RawTicket } from "../interfaces/RawTicket";
import socketEvents from "../utils/socketEvents";
import { getSocket, initiateSocket } from "../services/socket";
import { AuthContext } from "../context/AuthContext";
import { TicketRefunded, TicketUpdate } from "../types/types"; 
import { validateStatus } from "../utils/validateStatus"; 

const CustomerPurchasedTickets: React.FC = () => {
  // State Management
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [refundInProgress, setRefundInProgress] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<string>("");
  const [refundSuccess, setRefundSuccess] = useState<string>("");
  const [confirmRefund, setConfirmRefund] = useState<{
    show: boolean;
    ticketId: string | null;
  }>({ show: false, ticketId: null });

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const ticketsPerPage = 10;

  // Context and Authentication
  const { authToken, customerId } = useContext(AuthContext);
  const isAuthenticated = Boolean(authToken);
  const token = authToken;

  // Initialize Socket.io
  useEffect(() => {
    if (isAuthenticated && token) {
      initiateSocket(token);
    }

    const socket = getSocket();

    // Listen to TICKET_REFUNDED event
    socket?.on(socketEvents.TICKET_REFUNDED, (data: TicketRefunded) => {
      console.log("Received TICKET_REFUNDED:", data);
      setTickets((prevTickets) =>
        prevTickets.map((ticket) =>
          ticket.id === data.ticketId
            ? { ...ticket, status: "available", owner: null }
            : ticket
        )
      );
      setRefundSuccess("Ticket refunded successfully.");
    });

    // Listen to TICKET_UPDATE event
    socket?.on(socketEvents.TICKET_UPDATE, (data: TicketUpdate) => {
      console.log("Received TICKET_UPDATE:", data);
      setTickets((prevTickets) =>
        prevTickets.map((ticket) =>
          ticket.id === data.ticketId
            ? { ...ticket, status: data.status, owner: data.owner }
            : ticket
        )
      );
    });

    return () => {
      // Cleanup on component unmount
      socket?.off(socketEvents.TICKET_REFUNDED);
      socket?.off(socketEvents.TICKET_UPDATE);
     };
  }, [isAuthenticated, token]);

  // Fetch Tickets
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setIsLoading(true);
        setError("");

        if (!customerId) throw new Error("Customer ID not found.");

        const response = await api.get(`/customers/${customerId}/tickets`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Log the raw tickets data
        console.log("Raw tickets data:", response.data.ticketsPurchased);

        // Transform tickets data
        const transformedTickets: Ticket[] = response.data.ticketsPurchased.map(
          (ticket: RawTicket, index: number): Ticket => {
            let id = "";

            if (
              ticket._id &&
              typeof ticket._id === "object" &&
              "$oid" in ticket._id
            ) {
              id = ticket._id.$oid ?? "";
            } else if (typeof ticket._id === "string") {
              id = ticket._id;
            } else if (ticket.id) {
              id = ticket.id;
            } else {
              console.warn(`Ticket at index ${index} is missing an ID.`);
              id = `ticket-${index}`;
            }

            return {
              id,
              status: validateStatus(ticket.status),
              owner:
                typeof ticket.owner === "string"
                  ? ticket.owner
                  : ticket.owner?.$oid ?? null, 
              vendor:
                typeof ticket.vendor === "string"
                  ? ticket.vendor
                  : ticket.vendor?.$oid ?? "",
              price: ticket.price ?? 0,
              eventName: ticket.eventName ?? "",
              eventDate:
                typeof ticket.eventDate === "string"
                  ? ticket.eventDate
                  : ticket.eventDate?.$date ?? "",
              createdAt:
                typeof ticket.createdAt === "string"
                  ? ticket.createdAt
                  : ticket.createdAt?.$date ?? "",
              updatedAt:
                typeof ticket.updatedAt === "string"
                  ? ticket.updatedAt
                  : ticket.updatedAt?.$date ?? "",
            };
          }
        );

        console.log("Transformed tickets:", transformedTickets);

        setTickets(transformedTickets);
      } catch (err: unknown) {
        console.error("Error fetching tickets:", err);
        if (axios.isAxiosError(err)) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to fetch tickets."
          );
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated && token && customerId) {
      fetchTickets();
    }
  }, [isAuthenticated, token, customerId]);

  // Handle Refund Request
  const handleRefund = async (ticketId: string) => {
    try {
      setRefundError("");
      setRefundSuccess("");
      setRefundInProgress(ticketId); 

      if (!customerId) throw new Error("Customer ID not found.");

      // Send refund request
      const response = await api.post(`/customers/${customerId}/refund`, {
        ticketId,
      });

      console.log("Refund Response:", response.data);

      setRefundSuccess("Ticket refunded successfully.");
      setRefundInProgress(null);
    } catch (err: unknown) {
      console.error("Error refunding ticket:", err);
      if (axios.isAxiosError(err)) {
        setRefundError(
          err.response?.data?.message || err.message || "Failed to refund ticket."
        );
      } else if (err instanceof Error) {
        setRefundError(err.message);
      } else {
        setRefundError("An unknown error occurred.");
      }
      setRefundInProgress(null);
    }
  };

  const openConfirmRefund = (ticketId: string) => {
    setConfirmRefund({ show: true, ticketId });
  };

  const closeConfirmRefund = () => {
    setConfirmRefund({ show: false, ticketId: null });
  };

  const confirmRefundProcess = () => {
    if (confirmRefund.ticketId) {
      handleRefund(confirmRefund.ticketId);
      closeConfirmRefund();
    }
  };

  // Search and Filter Logic
  const filteredTickets = tickets.filter((ticket) => {
    const ticketId = ticket.id || "";
    return ticketId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Pagination Logic
  const indexOfLastTicket = currentPage * ticketsPerPage;
  const indexOfFirstTicket = indexOfLastTicket - ticketsPerPage;
  const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  // Handle ticket row click for detailed view
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };

  // Close detailed view modal
  const handleCloseDetail = () => {
    setSelectedTicket(null);
  };

  // Handle Sorting
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Ticket;
    direction: "ascending" | "descending";
  } | null>(null);

  const sortedTickets = React.useMemo(() => {
    const sortableTickets = [...filteredTickets];
    if (sortConfig !== null) {
      sortableTickets.sort((a, b) => {
        let aKey: string | number | null = a[sortConfig.key];
        let bKey: string | number | null = b[sortConfig.key];

        // Handle date fields
        if (["createdAt", "eventDate", "updatedAt"].includes(sortConfig.key)) {
          aKey = aKey ? new Date(aKey as string).getTime() : 0;
          bKey = bKey ? new Date(bKey as string).getTime() : 0;
        } else {
          aKey = aKey ?? "";
          bKey = bKey ?? "";
        }

        if (aKey < bKey) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (aKey > bKey) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableTickets;
  }, [filteredTickets, sortConfig]);
  
  const requestSort = (key: keyof Ticket) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const currentTicketsSorted = sortedTickets.slice(
    indexOfFirstTicket,
    indexOfLastTicket
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800 px-4 py-12">
      <div className="w-full max-w-4xl bg-gray-900 p-8 rounded-lg shadow-md relative">
        <h2 className="text-3xl font-semibold text-center text-white mb-6">
          Your Purchased Tickets
        </h2>

        {/* Search Input */}
        <div className="flex justify-center mb-4">
          <input
            type="text"
            placeholder="Search by Ticket ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center">
            <svg
              className="animate-spin h-8 w-8 text-blue-600"
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
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
            <span className="text-gray-300 ml-2">Loading tickets...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 text-red-700 bg-red-100 rounded">
            {error}
          </div>
        )}

        {/* Refund Success Message */}
        {refundSuccess && (
          <div className="mb-4 p-4 text-green-700 bg-green-100 rounded">
            {refundSuccess}
          </div>
        )}

        {/* Refund Error Message */}
        {refundError && (
          <div className="mb-4 p-4 text-red-700 bg-red-100 rounded">
            {refundError}
          </div>
        )}

        {/* Tickets Table */}
        {!isLoading && !error && filteredTickets.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-gray-700 text-white table-auto">
              <thead>
                <tr>
                  <th
                    className="py-2 px-4 border-b cursor-pointer"
                    onClick={() => requestSort("id")}
                  >
                    Ticket ID{" "}
                    {sortConfig?.key === "id"
                      ? sortConfig.direction === "ascending"
                        ? "↑"
                        : "↓"
                      : ""}
                  </th>
                  <th
                    className="py-2 px-4 border-b cursor-pointer"
                    onClick={() => requestSort("vendor")}
                  >
                    Vendor ID{" "}
                    {sortConfig?.key === "vendor"
                      ? sortConfig.direction === "ascending"
                        ? "↑"
                        : "↓"
                      : ""}
                  </th>
                  <th
                    className="py-2 px-4 border-b cursor-pointer"
                    onClick={() => requestSort("createdAt")}
                  >
                    Bought Time{" "}
                    {sortConfig?.key === "createdAt"
                      ? sortConfig.direction === "ascending"
                        ? "↑"
                        : "↓"
                      : ""}
                  </th>
                  <th
                    className="py-2 px-4 border-b cursor-pointer"
                    onClick={() => requestSort("price")}
                  >
                    Price (LKR){" "}
                    {sortConfig?.key === "price"
                      ? sortConfig.direction === "ascending"
                        ? "↑"
                        : "↓"
                      : ""}
                  </th>
                  <th className="py-2 px-4 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentTicketsSorted.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-gray-600 cursor-pointer"
                  >
                    <td
                      className="py-2 px-4 border-b text-center"
                      onClick={() => handleTicketClick(ticket)}
                    >
                      {ticket.id}
                    </td>
                    <td
                      className="py-2 px-4 border-b text-center"
                      onClick={() => handleTicketClick(ticket)}
                    >
                      {ticket.vendor}
                    </td>
                    <td
                      className="py-2 px-4 border-b text-center"
                      onClick={() => handleTicketClick(ticket)}
                    >
                      {new Date(ticket.createdAt).toLocaleString()}
                    </td>
                    <td
                      className="py-2 px-4 border-b text-center"
                      onClick={() => handleTicketClick(ticket)}
                    >
                      {ticket.price.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 border-b text-center">
                      {ticket.status === "sold" ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering row click
                            openConfirmRefund(ticket.id);
                          }}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition duration-200"
                          disabled={refundInProgress === ticket.id}
                        >
                          {refundInProgress === ticket.id ? "Refunding..." : "Refund"}
                        </button>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* No Tickets Found */}
        {!isLoading && !error && filteredTickets.length === 0 && (
          <div className="text-center text-gray-300">
            You have not purchased any tickets yet.
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && !error && filteredTickets.length > ticketsPerPage && (
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded ${
                currentPage === 1
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white`}
            >
              Previous
            </button>
            <span className="text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded ${
                currentPage === totalPages
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white`}
            >
              Next
            </button>
          </div>
        )}

        {/* Confirmation Modal */}
        {confirmRefund.show && (
          <Modal>
            <div className="bg-white p-6 rounded shadow-md">
              <h2 className="text-xl font-semibold mb-4">Confirm Refund</h2>
              <p className="mb-6">Are you sure you want to refund this ticket?</p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={confirmRefundProcess}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
                >
                  Yes, Refund
                </button>
                <button
                  onClick={closeConfirmRefund}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Detailed Ticket View Modal */}
        {selectedTicket && (
          <Modal>
            <div className="bg-white p-6 rounded shadow-md">
              <button
                onClick={handleCloseDetail}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label="Close Detailed View"
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

              <h3 className="text-xl font-semibold mb-4 text-center">
                Ticket Details
              </h3>
              <div>
                <p>
                  <span className="font-medium">Ticket ID:</span> {selectedTicket.id}
                </p>
                <p>
                  <span className="font-medium">Vendor ID:</span> {selectedTicket.vendor}
                </p>
                <p>
                  <span className="font-medium">Bought Time:</span>{" "}
                  {new Date(selectedTicket.createdAt).toLocaleString()}
                </p>
                <p>
                  <span className="font-medium">Price:</span> LKR{" "}
                  {selectedTicket.price.toLocaleString()}
                </p>
                <p>
                  <span className="font-medium">Status:</span> {selectedTicket.status}
                </p>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default CustomerPurchasedTickets;
