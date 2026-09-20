const Ticket = require("../models/ticket");
const Customer = require("../models/customer");
const ticketPool = require("../classes/TicketPool");
const Configuration = require("../classes/Configuration");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { getIO } = require("../utils/socket");
const socketEvents = require("../utils/socketEvents");
const logger = require("../utils/logger");

const safelyGetIO = () => {
  try {
    return getIO();
  } catch (err) {
    return null;
  }
};

/**
 * Get available tickets and current event details
 */
const getAvailableTickets = async (req, res, next) => {
  try {
    const config = await Configuration.getInstance();
    const maxTicketCapacity = config.getMaxTicketCapacity();

    const eventName = process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System";
    const eventDate = process.env.EVENT_DATE || "2024-12-20";

    const availableTickets = await Ticket.countDocuments({
      status: "available",
      eventName,
    });

    const sampleTicket = await Ticket.findOne({
      status: "available",
      eventName,
    });

    const ticketPrice = sampleTicket ? sampleTicket.price : (parseInt(process.env.TICKET_PRICE, 10) || 2800);

    const io = safelyGetIO();
    if (io) {
      io.emit(socketEvents.TICKET_UPDATE, {
        eventName,
        eventDate,
        availableTickets,
      });
    }

    return successResponse(res, 200, "Available tickets retrieved.", {
      eventDate: new Date(eventDate).toISOString().split("T")[0],
      ticketPrice,
      availableTickets,
      maxTicketCapacity,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get customer profile and their purchased tickets
 */
const getCustomerDetails = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId).populate("ticketsPurchased");
    if (!customer) {
      return errorResponse(res, 404, "Customer not found.", "CUSTOMER_NOT_FOUND");
    }

    const formattedTickets = (customer.ticketsPurchased || []).map((ticket) => ({
      id: ticket._id.toString(),
      status: ticket.status,
      owner: ticket.owner ? ticket.owner.toString() : null,
      vendor: ticket.vendor ? ticket.vendor.toString() : null,
      price: ticket.price,
      eventName: ticket.eventName,
      eventDate: ticket.eventDate,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    }));

    return successResponse(res, 200, "Customer details retrieved.", {
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        email: customer.email,
        mobileNumber: customer.mobileNumber,
        retrievalInterval: customer.retrievalInterval,
        ticketsPurchased: formattedTickets,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get tickets belonging to the specified customer
 */
const getCustomerTickets = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId).populate("ticketsPurchased");
    if (!customer) {
      return errorResponse(res, 404, "Customer not found.", "CUSTOMER_NOT_FOUND");
    }

    const ticketsPurchased = (customer.ticketsPurchased || []).map((ticket) => ({
      id: ticket._id.toString(),
      status: ticket.status,
      owner: ticket.owner ? ticket.owner.toString() : null,
      vendor: ticket.vendor ? ticket.vendor.toString() : null,
      price: ticket.price,
      eventName: ticket.eventName,
      eventDate: ticket.eventDate,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    }));

    return successResponse(res, 200, "Customer tickets retrieved successfully.", {
      ticketsPurchased,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Synchronous ticket purchase using atomic conditional updates.
 * Guarantees zero race conditions or overselling under high concurrency.
 */
const purchaseTicket = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    let { quantity } = req.body;

    quantity = parseInt(quantity, 10);
    if (isNaN(quantity) || quantity <= 0) {
      return errorResponse(res, 400, "Please provide a positive integer for quantity.", "INVALID_QUANTITY");
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return errorResponse(res, 404, "Customer not found.", "CUSTOMER_NOT_FOUND");
    }

    const result = await ticketPool.purchaseMultipleTickets(customerId, quantity);

    if (result.purchasedTickets.length === 0) {
      const io = safelyGetIO();
      if (io) {
        io.emit(socketEvents.PURCHASE_FAILURE, {
          customerId: customerId.toString(),
          message: "No tickets were available for purchase.",
        });
      }
      return errorResponse(
        res,
        409,
        "No tickets available for purchase in the pool.",
        "TICKETS_UNAVAILABLE"
      );
    }

    const formattedPurchased = result.purchasedTickets.map((t) => ({
      id: t._id.toString(),
      ticketId: t._id.toString(),
      price: t.price,
      eventName: t.eventName,
      eventDate: t.eventDate ? t.eventDate.toISOString().split("T")[0] : null,
      status: t.status,
    }));

    let message = `${result.purchasedTickets.length} ticket(s) purchased successfully.`;
    if (result.notPurchased > 0) {
      message += ` ${result.notPurchased} ticket(s) could not be fulfilled due to limited pool availability.`;
    }

    return successResponse(res, 200, message, {
      purchasedTickets: formattedPurchased,
      countPurchased: result.purchasedTickets.length,
      notPurchased: result.notPurchased,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Atomically refunds a ticket back to the shared pool.
 * Guarantees that only the genuine owner can refund a currently sold ticket,
 * and completely prevents double refunds.
 */
const refundTicket = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { ticketId } = req.body;

    if (!ticketId) {
      return errorResponse(res, 400, "Ticket ID is required for refund.", "MISSING_TICKET_ID");
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return errorResponse(res, 404, "Customer not found.", "CUSTOMER_NOT_FOUND");
    }

    try {
      const refundedTicket = await ticketPool.refundTicket(ticketId, customerId);

      if (!refundedTicket) {
        return errorResponse(
          res,
          404,
          "Ticket not found, does not belong to this customer, or has already been refunded.",
          "TICKET_NOT_FOUND"
        );
      }

      return successResponse(res, 200, "Ticket refunded successfully.", {
        ticket: {
          id: refundedTicket._id.toString(),
          status: refundedTicket.status,
          price: refundedTicket.price,
          eventName: refundedTicket.eventName,
          eventDate: refundedTicket.eventDate,
          updatedAt: refundedTicket.updatedAt,
        },
      });
    } catch (capacityError) {
      return errorResponse(
        res,
        400,
        capacityError.message,
        "POOL_CAPACITY_EXCEEDED"
      );
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAvailableTickets,
  getCustomerDetails,
  getCustomerTickets,
  purchaseTicket,
  refundTicket,
};
