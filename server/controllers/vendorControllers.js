const VendorModel = require("../models/vendor");
const Ticket = require("../models/ticket");
const ticketPool = require("../classes/TicketPool");
const VendorService = require("../classes/Vendor");
const Configuration = require("../classes/Configuration");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { getIO } = require("../utils/socket");
const socketEvents = require("../utils/socketEvents");
const logger = require("../utils/logger");

const activeVendors = {};

const safelyGetIO = () => {
  try {
    return getIO();
  } catch (err) {
    return null;
  }
};

/**
 * Add tickets to the pool directly (batch release)
 */
const addTickets = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    let { ticketCount } = req.body;

    ticketCount = parseInt(ticketCount, 10);
    if (isNaN(ticketCount) || ticketCount <= 0) {
      return errorResponse(res, 400, "Please provide a positive integer for ticketCount.", "INVALID_TICKET_COUNT");
    }

    const vendor = await VendorModel.findById(vendorId);
    if (!vendor) {
      return errorResponse(res, 404, "Vendor not found.", "VENDOR_NOT_FOUND");
    }

    const poolResult = await ticketPool.addTickets(ticketCount, vendorId);

    // Atomically increment vendor's lifetime addedTickets
    if (poolResult.added > 0) {
      await VendorModel.findByIdAndUpdate(vendorId, {
        $inc: { addedTickets: poolResult.added },
      });
    }

    let responseMessage = `${poolResult.added} tickets added successfully.`;
    if (poolResult.notAdded > 0) {
      responseMessage += ` ${poolResult.notAdded} tickets could not be added due to pool capacity limits.`;
    }

    const statusCode = poolResult.notAdded > 0 && poolResult.added === 0 ? 400 : 200;

    return successResponse(res, statusCode, responseMessage, {
      addedTickets: poolResult.added,
      notAddedTickets: poolResult.notAdded,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start automated ticket release interval for the authenticated vendor
 */
const startReleasingTickets = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    let { ticketsPerRelease } = req.body;

    const vendor = await VendorModel.findById(vendorId);
    if (!vendor) {
      return errorResponse(res, 404, "Vendor not found.", "VENDOR_NOT_FOUND");
    }

    const config = await Configuration.getInstance();
    const ticketReleaseRate = config.getTicketReleaseRate();

    const perRelease = ticketsPerRelease ? parseInt(ticketsPerRelease, 10) : vendor.ticketsPerRelease;
    if (isNaN(perRelease) || perRelease <= 0) {
      return errorResponse(res, 400, "ticketsPerRelease must be a positive integer.", "INVALID_INPUT");
    }

    if (activeVendors[vendorId]) {
      return errorResponse(res, 400, "Vendor is already actively releasing tickets.", "ALREADY_ACTIVE");
    }

    const vendorService = new VendorService(vendorId, perRelease, ticketReleaseRate);
    vendorService.startReleasingTickets(ticketPool);
    activeVendors[vendorId] = vendorService;

    const io = safelyGetIO();
    if (io) {
      const totalReleasedTickets = await ticketPool.getTotalReleasedTickets();
      io.emit(socketEvents.SYSTEM_STATUS, {
        status: "ticketReleaseStarted",
        message: `Vendor ${vendor.name} started releasing tickets.`,
        eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
        eventDate: process.env.EVENT_DATE || "2024-12-20",
        availableTickets: totalReleasedTickets,
      });
    }

    return successResponse(res, 200, "Automated ticket release started.");
  } catch (error) {
    next(error);
  }
};

/**
 * Stop automated ticket release interval for the authenticated vendor
 */
const stopReleasingTickets = async (req, res, next) => {
  try {
    const vendorId = req.user.id;

    const vendorService = activeVendors[vendorId];
    if (!vendorService) {
      return errorResponse(res, 400, "Vendor is not actively releasing tickets.", "NOT_ACTIVE");
    }

    await vendorService.stopReleasingTickets();
    delete activeVendors[vendorId];

    return successResponse(res, 200, "Automated ticket release stopped.");
  } catch (error) {
    next(error);
  }
};

/**
 * Delete all currently available tickets in the pool
 */
const deleteAvailableTickets = async (req, res, next) => {
  try {
    const deletedCount = await ticketPool.deleteAvailableTickets();
    return successResponse(res, 200, `Successfully deleted ${deletedCount} available tickets.`, {
      deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all tickets (sold & available) released by the authenticated vendor
 */
const getVendorTickets = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const tickets = await Ticket.find({ vendor: vendorId })
      .populate("owner", "name email mobileNumber")
      .lean();

    const formattedTickets = tickets.map((t) => ({
      id: t._id.toString(),
      status: t.status,
      owner: t.owner,
      price: t.price,
      eventName: t.eventName,
      eventDate: t.eventDate,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return successResponse(res, 200, "Vendor tickets retrieved.", {
      tickets: formattedTickets,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get count of available tickets released by the authenticated vendor
 */
const getVendorReleasedTickets = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const releasedTickets = await ticketPool.getReleasedTickets(vendorId);

    return successResponse(res, 200, "Released tickets retrieved.", {
      releasedTickets,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get count of total released tickets available across all vendors
 */
const getTotalReleasedTickets = async (req, res, next) => {
  try {
    const totalReleasedTickets = await ticketPool.getTotalReleasedTickets();

    return successResponse(res, 200, "Total released tickets retrieved.", {
      releasedTickets: totalReleasedTickets,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get count of sold tickets released by the authenticated vendor
 */
const getVendorSoldTickets = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const soldTickets = await Ticket.countDocuments({
      vendor: vendorId,
      status: "sold",
    });

    return successResponse(res, 200, "Sold tickets retrieved.", {
      soldTickets,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get overall ticket pool status and vendor's release count
 */
const getTicketPoolStatus = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const availableTickets = await ticketPool.getAvailableTickets();
    const maxCapacity = ticketPool.getMaxCapacity();

    const vendor = await VendorModel.findById(vendorId);
    const vendorReleasedTickets = vendor ? vendor.addedTickets : 0;

    return successResponse(res, 200, "Ticket pool status retrieved.", {
      availableTickets,
      maxCapacity,
      vendorReleasedTickets,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addTickets,
  startReleasingTickets,
  stopReleasingTickets,
  deleteAvailableTickets,
  getVendorTickets,
  getVendorReleasedTickets,
  getTotalReleasedTickets,
  getVendorSoldTickets,
  getTicketPoolStatus,
};
