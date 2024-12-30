const { getIO } = require("../utils/socket");
const VendorModel = require("../models/vendor");
const ticketPool = require("../classes/TicketPool"); // Singleton instance
const VendorService = require("../classes/Vendor");
const jwt = require("jsonwebtoken");
const socketEvents = require("../utils/socketEvents");
const Configuration = require("../classes/Configuration");
const Ticket = require('../models/ticket');

// Store active vendor instances
const activeVendors = {};

// Helper function to generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "1h", // Token expires in 1 hour
  });
};

// Controller to get sold tickets for the logged-in vendor.
const getVendorSoldTickets = async (req, res) => {
  try {
    const vendorId = req.user.id;

    if (!vendorId) {
      console.warn("Vendor ID is missing in the request.");
      return res.status(400).json({ message: "Vendor ID is missing." });
    }

    const vendor = await VendorModel.findById(vendorId);
    if (!vendor) {
      console.warn(`Vendor not found: ID ${vendorId}`);
      return res.status(404).json({ message: `Vendor not found: ID ${vendorId}` });
    }

    const soldTicketsCount = await Ticket.countDocuments({
      vendor: vendorId,
      status: "sold",
    });

    console.log(`Vendor ID: ${vendorId}, Sold Tickets Count: ${soldTicketsCount}`);

    res.status(200).json({
      message: 'Sold tickets retrieved successfully.',
      soldTickets: soldTicketsCount,
    });
  } catch (error) {
    console.error('Error fetching sold tickets:', error);
    res.status(500).json({
      message: 'Error fetching sold tickets.',
      error: error.message,
    });
  }
};

// Register a new vendor
const registerVendor = async (req, res) => {
  const { name, email, password, ticketsPerRelease } = req.body;

  // Basic validation
  if (!name || !email || password === undefined) {
    return res.status(400).json({ message: "Please provide all required fields." });
  }

  try {
    // Fetch configuration
    const config = await Configuration.getInstance();
    const ticketReleaseRate = config.getTicketReleaseRate();

    // Check if vendor already exists
    let vendor = await VendorModel.findOne({ email });
    if (vendor) {
      return res.status(400).json({ message: "Vendor already exists." });
    }

    // Create new vendor
    vendor = new VendorModel({
      name,
      email,
      password,
      ticketsPerRelease,
      releaseInterval: ticketReleaseRate, // Set from config
      addedTickets: 0,
    });

    // Save vendor to database
    await vendor.save();

    // Generate JWT token
    const token = generateToken(vendor._id, "vendor");

    // Emit systemStatus event to notify clients about new vendor registration
    const io = getIO();
    io.emit(socketEvents.SYSTEM_STATUS, {
      status: "vendorRegistered",
      message: `Vendor ${vendor.name} registered.`,
      eventName: process.env.EVENT_NAME,
      eventDate: process.env.EVENT_DATE,
    });

    res.status(201).json({
      message: "Vendor registered successfully.",
      token,
    });
  } catch (error) {
    console.error("Error registering vendor:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

// Login vendor
const loginVendor = async (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: "Please provide email and password." });
  }

  try {
    // Check if vendor exists
    const vendor = await VendorModel.findOne({ email });
    if (!vendor) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Check if password matches
    const isMatch = await vendor.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Generate JWT token
    const token = generateToken(vendor._id, "vendor");

    // Emit systemStatus event to notify clients about vendor login
    const io = getIO();
    io.emit(socketEvents.SYSTEM_STATUS, {
      status: "vendorLoggedIn",
      message: `Vendor ${vendor.email} logged in.`,
      eventName: process.env.EVENT_NAME,
      eventDate: process.env.EVENT_DATE,
    });

    res.status(200).json({
      message: "Login successful.",
      token,
    });
  } catch (error) {
    console.error("Error logging in vendor:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

// Add Tickets
const addTickets = async (req, res) => {
  console.log("Received request to add tickets:", req.body);

  let { ticketCount } = req.body;

  // Retrieve vendorId from authenticated user
  const vendorId = req.user && req.user.id;

  // Parse ticketCount as integer
  ticketCount = parseInt(ticketCount, 10);

  // Validate ticketCount
  if (isNaN(ticketCount) || ticketCount <= 0) {
    return res.status(400).json({ message: "Please provide a positive integer for ticketCount." });
  }

  console.log(`Parsed ticketCount: ${ticketCount}`);
  console.log(`Vendor ID: ${vendorId}`);
  console.log(`Type of ticketCount: ${typeof ticketCount}`);
  console.log(`Type of vendorId: ${typeof vendorId}`);

  try {
    // Ensure the vendor exists
    const vendor = await VendorModel.findById(vendorId);
    if (!vendor) {
      console.log("Vendor not found.");
      return res.status(404).json({ message: "Vendor not found." });
    }

    console.log(`Vendor found: ${vendor.name} (${vendor.email})`);

    // Add tickets to the pool
    const poolResult = await ticketPool.addTickets(ticketCount, vendorId);

    console.log("Pool Result:", poolResult);

    // Validate poolResult
    if (!poolResult || typeof poolResult.added !== "number" || typeof poolResult.notAdded !== "number") {
      console.error("Invalid poolResult:", poolResult);
      return res.status(500).json({ message: "Invalid response from ticket pool." });
    }

    // Increment vendor's addedTickets count**
    vendor.addedTickets += poolResult.added;
    await vendor.save();

    let responseMessage = `${poolResult.added} tickets added successfully.`;
    if (poolResult.notAdded > 0) {
      responseMessage += ` ${poolResult.notAdded} tickets could not be added due to pool capacity limits.`;
    }

    const statusCode = poolResult.notAdded > 0 ? 400 : 200;

    res.status(statusCode).json({
      message: responseMessage,
      addedTickets: poolResult.added,
      notAddedTickets: poolResult.notAdded,
    });

    // Emit Socket.IO events
    const io = getIO();

    if (poolResult.added > 0) {
      const totalReleasedTickets = await ticketPool.getTotalReleasedTickets();

      io.emit(socketEvents.VENDOR_RELEASED_TICKETS, {
        vendorId: vendor._id.toString(),
        quantity: poolResult.added,
        message: `Vendor ${vendor.name} released ${poolResult.added} tickets.`,
        eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
        eventDate: process.env.EVENT_DATE || "2024-12-20",
        availableTickets: totalReleasedTickets,
      });

      io.emit(socketEvents.TICKET_UPDATE, {
        eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
        eventDate: process.env.EVENT_DATE || "2024-12-20",
        availableTickets: totalReleasedTickets,
      });
    }
  } catch (error) {
    console.error("Error adding tickets:", error);
    res.status(500).json({ message: "Error adding tickets.", error: error.message });
  }
};

// Start releasing tickets at intervals
const startReleasingTickets = async (req, res) => {
  const { ticketsPerRelease } = req.body;
  const email = req.user.email; // Extract email from authenticated user

  // Validate ticketsPerRelease
  if (!ticketsPerRelease || !Number.isInteger(ticketsPerRelease) || ticketsPerRelease <= 0) {
    return res.status(400).json({ message: "Please provide a positive integer for ticketsPerRelease." });
  }

  try {
    // Fetch configuration
    const config = await Configuration.getInstance();
    const ticketReleaseRate = config.getTicketReleaseRate();

    // Find the vendor by email
    const vendor = await VendorModel.findOne({ email });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found." });
    }

    // Check if the vendor is already releasing tickets
    if (activeVendors[email]) {
      return res.status(400).json({ message: "Vendor is already releasing tickets." });
    }

    // Start releasing tickets using VendorService class
    const vendorService = new VendorService(
      vendor._id.toString(), // Use vendorId internally
      ticketsPerRelease,
      ticketReleaseRate
    );
    vendorService.startReleasingTickets(ticketPool);

    // Store the active vendor instance for tracking, keyed by email
    activeVendors[email] = vendorService;

    // Emit systemStatus event to notify clients about ticket release start
    const io = getIO();
    const totalReleasedTickets = await ticketPool.getTotalReleasedTickets();

    io.emit(socketEvents.SYSTEM_STATUS, {
      status: "ticketReleaseStarted",
      message: `Vendor ${vendor.name} started releasing tickets.`,
      eventName: process.env.EVENT_NAME,
      eventDate: process.env.EVENT_DATE,
      availableTickets: totalReleasedTickets,
    });

    res.status(200).json({ message: "Ticket release started." });
  } catch (error) {
    console.error("Error starting ticket release:", error);
    res.status(500).json({ message: "Error starting ticket release.", error: error.message });
  }
};

// Stop releasing tickets
const stopReleasingTickets = async (req, res) => {
  const email = req.user.email; // Extract email from authenticated user

  try {
    // Find the vendor by email
    const vendor = await VendorModel.findOne({ email });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found." });
    }

    // Check if the vendor is actively releasing tickets
    const vendorService = activeVendors[email];
    if (!vendorService) {
      return res.status(400).json({ message: "Vendor is not actively releasing tickets." });
    }

    // Stop releasing tickets
    vendorService.stopReleasingTickets();

    // Remove the vendor from activeVendors
    delete activeVendors[email];

    // Emit systemStatus event to notify clients about ticket release stop
    const io = getIO();
    const totalReleasedTickets = await ticketPool.getTotalReleasedTickets();

    io.emit(socketEvents.SYSTEM_STATUS, {
      status: "ticketReleaseStopped",
      message: `Vendor ${vendor.name} stopped releasing tickets.`,
      eventName: process.env.EVENT_NAME,
      eventDate: process.env.EVENT_DATE,
      availableTickets: totalReleasedTickets,
    });

    res.status(200).json({ message: "Ticket release stopped." });
  } catch (error) {
    console.error("Error stopping ticket release:", error);
    res.status(500).json({ message: "Error stopping ticket release.", error: error.message });
  }
};

// Delete all available tickets from the pool
const deleteAvailableTickets = async (req, res) => {
  try {
    // Ensure the user is authenticated and is a vendor
    if (req.user.role !== "vendor") {
      return res.status(403).json({ message: "Access denied. Not a vendor." });
    }

    // Call the deleteAvailableTickets method from TicketPool
    const deletedCount = await ticketPool.deleteAvailableTickets();

    res.status(200).json({
      message: `Successfully deleted ${deletedCount} available tickets.`,
      deletedCount,
    });
  } catch (error) {
    console.error("Error deleting tickets:", error);
    res.status(500).json({
      message: "Error deleting tickets.",
      error: error.message,
    });
  }
};

// Get tickets released by the logged-in vendor
const getVendorTickets = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const tickets = await Ticket.find({ vendor: vendorId })
      .populate('owner', '_id') 
      .lean();

    res.status(200).json({
      message: 'Tickets retrieved successfully.',
      tickets,
    });
  } catch (error) {
    console.error('Error fetching vendor tickets:', error);
    res.status(500).json({
      message: 'Error fetching vendor tickets.',
      error: error.message,
    });
  }
};

// Controller to get released tickets for the logged-in vendor.
const getVendorReleasedTickets = async (req, res) => {
  try {
    const vendorId = req.user.id;

    // Fetch the count of released tickets using TicketPool's method
    const releasedTickets = await ticketPool.getReleasedTickets(vendorId);

    res.status(200).json({
      message: 'Released tickets retrieved successfully.',
      releasedTickets, 
    });
  } catch (error) {
    console.error('Error fetching released tickets:', error);
    res.status(500).json({
      message: 'Error fetching released tickets.',
      error: error.message,
    });
  }
};

// Controller to get total released tickets across all vendors.
const getTotalReleasedTickets = async (req, res) => {
  try {
    const totalReleasedTickets = await ticketPool.getTotalReleasedTickets();

    res.status(200).json({
      message: 'Total released tickets retrieved successfully.',
      releasedTickets: totalReleasedTickets,
    });
  } catch (error) {
    console.error('Error fetching total released tickets:', error);
    res.status(500).json({
      message: 'Error fetching total released tickets.',
      error: error.message,
    });
  }
};

// Get the status of the ticket pool
const getTicketPoolStatus = async (req, res) => {
  console.log("getTicketPoolStatus function called!");

  try {
    console.log("Fetching ticket pool status...");

    // Get global ticket pool data
    const availableTickets = await ticketPool.getAvailableTickets();
    const maxCapacity = ticketPool.getMaxCapacity();

    // Retrieve vendorId from authenticated user
    const vendorId = req.user && req.user.id;

    // Fetch the vendor's addedTickets
    const vendor = await VendorModel.findById(vendorId);
    let vendorReleasedTickets = 0;
    if (vendor) {
      vendorReleasedTickets = vendor.addedTickets;
    } else {
      console.log("Vendor not found.");
    }

    console.log(
      `Available tickets: ${availableTickets} (Type: ${typeof availableTickets}), Max capacity: ${maxCapacity}, Vendor released tickets: ${vendorReleasedTickets}`
    );

    res.status(200).json({
      availableTickets,
      maxCapacity,
      vendorReleasedTickets,
    });
  } catch (error) {
    console.error("Error fetching ticket pool status:", error);
    res.status(500).json({
      message: "Error fetching ticket pool status.",
      error: error.message,
    });
  }
};

module.exports = {
  registerVendor,
  loginVendor,
  addTickets,
  startReleasingTickets,
  stopReleasingTickets,
  getTicketPoolStatus,
  deleteAvailableTickets,
  getVendorTickets,
  getVendorReleasedTickets,
  getTotalReleasedTickets,
  getVendorSoldTickets,
};
