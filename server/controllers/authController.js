const jwt = require("jsonwebtoken");
const Customer = require("../models/customer");
const Vendor = require("../models/vendor");
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
 * Generate signed JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign({ id: userId.toString(), role }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });
};

/**
 * Customer Registration
 */
const registerCustomer = async (req, res, next) => {
  try {
    const { name, email, mobileNumber, password } = req.body;

    const existingCustomer = await Customer.findOne({
      $or: [{ email: email.toLowerCase() }, { mobileNumber }],
    });

    if (existingCustomer) {
      return errorResponse(res, 409, "Email or mobile number is already registered.", "DUPLICATE_RESOURCE");
    }

    const config = await Configuration.getInstance();
    const retrievalInterval = config.getCustomerRetrievalRate();

    const customer = new Customer({
      name,
      email: email.toLowerCase(),
      mobileNumber,
      password,
      retrievalInterval,
      role: "customer",
    });

    await customer.save();

    const token = generateToken(customer._id, "customer");
    logger.info(`Customer registered: ${customer.email} (ID: ${customer._id})`);

    return successResponse(res, 201, "Customer registered successfully.", {
      token,
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        email: customer.email,
        mobileNumber: customer.mobileNumber,
        retrievalInterval: customer.retrievalInterval,
        role: "customer",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer Login
 */
const loginCustomer = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const customer = await Customer.findOne({ email: email.toLowerCase() });
    if (!customer) {
      return errorResponse(res, 401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }

    const isMatch = await customer.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }

    const token = generateToken(customer._id, "customer");
    logger.info(`Customer logged in: ${customer.email}`);

    return successResponse(res, 200, "Login successful.", {
      token,
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        email: customer.email,
        mobileNumber: customer.mobileNumber,
        retrievalInterval: customer.retrievalInterval,
        role: "customer",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vendor Registration
 */
const registerVendor = async (req, res, next) => {
  try {
    const { name, email, password, ticketsPerRelease } = req.body;

    const existingVendor = await Vendor.findOne({ email: email.toLowerCase() });
    if (existingVendor) {
      return errorResponse(res, 409, "A vendor account with this email already exists.", "DUPLICATE_RESOURCE");
    }

    const config = await Configuration.getInstance();
    const releaseInterval = config.getTicketReleaseRate();

    const vendor = new Vendor({
      name,
      email: email.toLowerCase(),
      password,
      ticketsPerRelease: ticketsPerRelease ? parseInt(ticketsPerRelease, 10) : 10,
      releaseInterval,
      addedTickets: 0,
      role: "vendor",
    });

    await vendor.save();

    const token = generateToken(vendor._id, "vendor");
    logger.info(`Vendor registered: ${vendor.email} (ID: ${vendor._id})`);

    const io = safelyGetIO();
    if (io) {
      io.emit(socketEvents.SYSTEM_STATUS, {
        status: "vendorRegistered",
        message: `Vendor ${vendor.name} registered.`,
        eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
        eventDate: process.env.EVENT_DATE || "2024-12-20",
      });
    }

    return successResponse(res, 201, "Vendor registered successfully.", {
      token,
      vendor: {
        id: vendor._id.toString(),
        name: vendor.name,
        email: vendor.email,
        ticketsPerRelease: vendor.ticketsPerRelease,
        releaseInterval: vendor.releaseInterval,
        role: "vendor",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vendor Login
 */
const loginVendor = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const vendor = await Vendor.findOne({ email: email.toLowerCase() });
    if (!vendor) {
      return errorResponse(res, 401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }

    const isMatch = await vendor.matchPassword(password);
    if (!isMatch) {
      return errorResponse(res, 401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }

    const token = generateToken(vendor._id, "vendor");
    logger.info(`Vendor logged in: ${vendor.email}`);

    const io = safelyGetIO();
    if (io) {
      io.emit(socketEvents.SYSTEM_STATUS, {
        status: "vendorLoggedIn",
        message: `Vendor ${vendor.email} logged in.`,
        eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
        eventDate: process.env.EVENT_DATE || "2024-12-20",
      });
    }

    return successResponse(res, 200, "Login successful.", {
      token,
      vendor: {
        id: vendor._id.toString(),
        name: vendor.name,
        email: vendor.email,
        role: "vendor",
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateToken,
  registerCustomer,
  loginCustomer,
  registerVendor,
  loginVendor,
};
