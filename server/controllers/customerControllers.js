const { getIO, getConnectedClientSocketId } = require("../utils/socket");
const Ticket = require("../models/ticket");
const mongoose = require("mongoose");
const CustomerModel = require("../models/customer");
const socketEvents = require("../utils/socketEvents");
const jwt = require("jsonwebtoken");
const ticketPool = require("../classes/TicketPool");
const Configuration = require("../classes/Configuration");
const VendorModel = require("../models/vendor"); 

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const registerCustomer = async (req, res) => {
  const { name, email, mobileNumber, password } = req.body;

  try {
    // Input validation
    const config = await Configuration.getInstance();
    const customerRetrievalRate = config.getCustomerRetrievalRate();

    // Input validation
    if (!name || !email || !mobileNumber || !password) {
      return res.status(400).json({
        message: "Name, email, mobile number, and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long.",
      });
    }

    // Check for existing email or mobile number
    const existingCustomer = await CustomerModel.findOne({
      $or: [{ email }, { mobileNumber }],
    });

    if (existingCustomer) {
      return res
        .status(409)
        .json({ message: "Email or mobile number already in use." });
    }

    // Create a new customer with retrievalInterval from config
    const newCustomer = new CustomerModel({
      name,
      email,
      mobileNumber,
      retrievalInterval: customerRetrievalRate, // Set from config
      password, // Password will be hashed by pre-save middleware
      ticketsPurchased: [],
      role: "customer",
    });

    const savedCustomer = await newCustomer.save();

    // Generate JWT Token upon successful registration
    const token = jwt.sign(
      { id: savedCustomer._id, role: savedCustomer.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({
      message: "Customer registered successfully.",
      customer: {
        id: savedCustomer._id,
        name: savedCustomer.name,
        email: savedCustomer.email,
        mobileNumber: savedCustomer.mobileNumber,
        retrievalInterval: savedCustomer.retrievalInterval,
      },
      token, // Return JWT Token
    });
  } catch (error) {
    console.error("Error registering customer:", error);
    res
      .status(500)
      .json({ message: "Error registering customer.", error: error.message });
  }
};

const loginCustomer = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    // Find customer by email
    const customer = await CustomerModel.findOne({ email });

    if (!customer) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Compare passwords
    const isMatch = await customer.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: customer._id, role: customer.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful.",
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        mobileNumber: customer.mobileNumber,
        retrievalInterval: customer.retrievalInterval,
      },
      token,
    });
  } catch (error) {
    console.error("Error logging in customer:", error);
    res
      .status(500)
      .json({ message: "Error logging in customer.", error: error.message });
  }
};

const getCustomerDetails = async (req, res) => {
  const { customerId } = req.params;

  try {
    if (!isValidObjectId(customerId)) {
      return res.status(400).json({ message: "Invalid Customer ID format." });
    }

    const customer = await CustomerModel.findById(customerId).populate(
      "ticketsPurchased"
    );

    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    res.status(200).json({
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        mobileNumber: customer.mobileNumber,
        retrievalInterval: customer.retrievalInterval,
        ticketsPurchased: customer.ticketsPurchased.map((ticket) => ({
          id: ticket._id,
          status: ticket.status,
          owner: ticket.owner,
          vendor: ticket.vendor,
          price: ticket.price,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching customer details:", error);
    res.status(500).json({
      message: "Error fetching customer details.",
      error: error.message,
    });
  }
};

const getAvailableTickets = async (req, res) => {
  try {
    // Configuration instance 
    const config = await Configuration.getInstance();
    const maxTicketCapacity = config.getMaxTicketCapacity();

    // Define event details 
    const eventName = process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System";
    const eventDate = process.env.EVENT_DATE || "2024-12-20";

    // Count available tickets
    const availableTickets = await Ticket.countDocuments({
      status: "available",
      eventName: eventName,
      eventDate: eventDate,
    });

    // Fetch ticket price 
    const ticket = await Ticket.findOne({
      eventName: eventName,
      eventDate: eventDate,
      status: "available",
    });

    const ticketPrice = ticket ? ticket.price : 0;

    // Emit ticketUpdate event to all connected clients
    const io = getIO();
    io.emit(socketEvents.TICKET_UPDATE, {
      eventName,
      eventDate,
      availableTickets,
    });

    res.status(200).json({
      eventDate: new Date(eventDate).toISOString().split("T")[0], // Format: YYYY-MM-DD
      ticketPrice: ticketPrice,
      availableTickets: availableTickets,
      maxTicketCapacity: maxTicketCapacity,
    });
  } catch (error) {
    console.error("Error fetching available tickets:", error);
    res.status(500).json({
      message: "Error fetching available tickets.",
      error: error.message,
    });
  }
};

// Add tickets to the pool
const addTickets = async (req, res) => {
  console.log("Received request to add tickets:", req.body);

  let { ticketCount } = req.body;
  const vendorId = req.vendor.id; // Retrieve from authenticated user

  // Parse ticketCount as integer
  ticketCount = parseInt(ticketCount, 10);

  // Validate ticketCount
  if (isNaN(ticketCount) || ticketCount <= 0) {
    return res
      .status(400)
      .json({ message: "Please provide a positive integer for ticketCount." });
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
    if (
      !poolResult ||
      typeof poolResult.added !== "number" ||
      typeof poolResult.notAdded !== "number"
    ) {
      console.error("Invalid poolResult:", poolResult);
      return res
        .status(500)
        .json({ message: "Invalid response from ticket pool." });
    }

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
      io.emit(socketEvents.VENDOR_RELEASED_TICKETS, {
        vendorId: vendor._id.toString(),
        quantity: poolResult.added,
        message: `Vendor ${vendor.name} released ${poolResult.added} tickets.`,
        eventName:
          process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
        eventDate: process.env.EVENT_DATE || "2024-12-20",
        availableTickets: await this.getTotalReleasedTickets(), 
      });
    }


    io.emit(socketEvents.TICKET_UPDATE, {
      eventName:
        process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
      eventDate: process.env.EVENT_DATE || "2024-12-20",
      availableTickets: await this.getTotalReleasedTickets(), 
    });
  } catch (error) {
    console.error("Error adding tickets:", error);
    res
      .status(500)
      .json({ message: "Error adding tickets.", error: error.message });
  }
};
const purchaseTicket = async (req, res) => {
  const { customerId } = req.params;
  const { quantity } = req.body;

  console.log("Entering purchaseTicket controller.");
  console.log("ticketPool:", ticketPool);

  // Validate input
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ message: "Invalid ticket quantity." });
  }

  try {
    // Verify customer exists
    const customer = await CustomerModel.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    // Acknowledge purchase initiation
    res.status(200).json({
      message: "Purchase initiated. Tickets will be delivered shortly.",
    });

    const io = getIO();

    // Ensure the client is connected
    const socketId = getConnectedClientSocketId(customerId);
    if (!socketId) {
      console.error(`No socket connection found for customerId: ${customerId}`);
      return;
    }

    // Get the retrieval rate from configuration
    const config = await Configuration.getInstance();
    const retrievalRate = config.getCustomerRetrievalRate(); // In milliseconds

    let ticketsPurchased = 0;

    for (let i = 0; i < quantity; i++) {
      // Remove one ticket from the ticketPool
      const ticket = await ticketPool.removeOneTicket(customerId);

      if (!ticket) {
        // No more tickets available
        console.error("No more tickets available for purchase.");
        // Emit an error event to the customer
        io.to(socketId).emit("purchaseError", {
          message: "No more tickets available.",
        });
        break;
      }

      // The ticket has already been updated in removeOneTicket
      // Add ticket to customer's purchased tickets
      await CustomerModel.findByIdAndUpdate(customerId, {
        $push: { ticketsPurchased: ticket._id },
      });

      // Emit the ticket to the customer
      io.to(socketId).emit("ticketRetrieved", {
        ticket: {
          id: ticket._id.toString(),
          ticketId: ticket._id.toString(),
          price: ticket.price,
          eventName: ticket.eventName,
          eventDate: ticket.eventDate.toISOString().split("T")[0],
        },
      });

      // **Emit a 'ticketSold' event to the vendors**
      const totalReleasedTickets = await ticketPool.getTotalReleasedTickets();
      io.emit(socketEvents.TICKET_SOLD, {
        ticketId: ticket._id.toString(),
        availableTickets: totalReleasedTickets,
        message: "A ticket has been sold.",
      });

      ticketsPurchased += 1;

      // Wait for the retrieval rate interval before sending the next ticket
      await new Promise((resolve) => setTimeout(resolve, retrievalRate));
    }

    if (ticketsPurchased > 0) {
      // Emit completion event to the customer
      io.to(socketId).emit("purchaseComplete", {
        message: "All tickets have been retrieved.",
      });
    } else {
      // No tickets were purchased
      // Emit purchaseFailure event to vendors
      io.emit(socketEvents.PURCHASE_FAILURE, {
        message: "No tickets were available for purchase.",
      });
    }
  } catch (error) {
    console.error("Error purchasing tickets:", error);

    const io = getIO();
    const socketId = getConnectedClientSocketId(customerId);
    if (socketId) {
      io.to(socketId).emit("purchaseError", {
        message: "An error occurred during ticket purchase.",
      });
    }

    // Emit purchaseFailure event to vendors
    io.emit(socketEvents.PURCHASE_FAILURE, {
      message: "An error occurred during ticket purchase.",
    });
  }
};

const getCustomerTickets = async (req, res) => {
  const { customerId } = req.params;

  try {
    if (!isValidObjectId(customerId)) {
      return res.status(400).json({ message: "Invalid Customer ID format." });
    }

    const customer = await CustomerModel.findById(customerId).populate(
      "ticketsPurchased"
    );

    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    res.status(200).json({
      ticketsPurchased: customer.ticketsPurchased.map((ticket) => ({
        id: ticket._id,
        status: ticket.status,
        owner: ticket.owner,
        vendor: ticket.vendor,
        price: ticket.price,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching customer tickets:", error);
    res.status(500).json({
      message: "Error fetching customer tickets.",
      error: error.message,
    });
  }
};

const refundTicket = async (req, res) => {
  const { customerId } = req.params;
  const { ticketId } = req.body;
  const io = getIO();

  // Declare variables in the outer scope
  let customer;
  let ticket;

  try {
    if (!isValidObjectId(customerId) || !isValidObjectId(ticketId)) {
      return res
        .status(400)
        .json({ message: "Invalid Customer ID or Ticket ID format." });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the customer
      customer = await CustomerModel.findById(customerId).session(session);

      if (!customer) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Customer not found." });
      }

      // Check if the ticket is owned by the customer
      ticket = await Ticket.findOne({
        _id: ticketId,
        owner: customerId,
      }).session(session);

      if (!ticket) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          message: "Ticket not found or does not belong to the customer.",
        });
      }

      // Update the ticket's status and owner
      ticket.status = "available";
      ticket.owner = null;
      await ticket.save({ session });

      // Remove the ticket from the customer's purchased tickets
      customer.ticketsPurchased.pull(ticketId);
      await customer.save({ session });

      // Add the ticket back to the pool
      await ticketPool.addExistingTicket(ticket, session);

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

    } catch (transactionError) {
      // If any error occurs, abort the transaction
      await session.abortTransaction();
      session.endSession();
      throw transactionError;
    }

    try {
      // Emit ticketRefunded and ticketUpdate events
      const totalReleasedTickets = await ticketPool.getTotalReleasedTickets();

      io.emit(socketEvents.TICKET_REFUNDED, {
        customerId,
        ticketId,
        message: "Ticket refunded successfully.",
        eventName: process.env.EVENT_NAME,
        eventDate: process.env.EVENT_DATE,
      });

      io.emit(socketEvents.TICKET_UPDATE, {
        availableTickets: totalReleasedTickets,
        eventName: process.env.EVENT_NAME,
        eventDate: process.env.EVENT_DATE,
      });

      res.status(200).json({
        message: "Ticket refunded successfully.",
        ticket: {
          id: ticket._id,
          status: ticket.status,
          owner: ticket.owner,
          vendor: ticket.vendor,
          price: ticket.price,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
        },
      });
    } catch (postTransactionError) {
      console.error("Error after transaction commit:", postTransactionError);
      // Handle errors that occur after transaction commit
      res.status(500).json({
        message: "Error after transaction commit.",
        error: postTransactionError.message,
      });
    }
  } catch (error) {
    console.error("Error refunding ticket:", error);
    res
      .status(500)
      .json({ message: "Error refunding ticket.", error: error.message });
  }
};

module.exports = {
  registerCustomer,
  loginCustomer,
  getCustomerDetails,
  purchaseTicket,
  getCustomerTickets,
  refundTicket,
  addTickets,
  getAvailableTickets,
};
