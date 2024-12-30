const express = require("express");
const router = express.Router();
const {
  registerVendor,
  loginVendor,
  addTickets,
  startReleasingTickets,
  stopReleasingTickets,
  getTicketPoolStatus,
  getVendorTickets,
  getVendorReleasedTickets, 
  getTotalReleasedTickets,
  getVendorSoldTickets,
} = require("../controllers/vendorControllers");
const authenticateToken = require("../middleware/authenticateToken");
const { body, validationResult } = require("express-validator");
const ticketPool = require("../classes/TicketPool");

// Vendor Registration Route
router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name is required."),
    body("email").isEmail().withMessage("Please provide a valid email."),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long."),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  registerVendor
);

// Vendor Login Route
router.post("/login", loginVendor);

// Apply Authentication Middleware to Protected Routes Globally
router.use(authenticateToken);

// Protected Route: Delete Available Tickets
router.delete("/delete-available-tickets", async (req, res) => {
  try {
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
});

// Example Protected Route
router.get("/protected", (req, res) => {
  res.status(200).json({
    message: `Welcome, ${req.user.name}! You have access to this protected route.`,
  });
});

// Protected Route: Add Tickets with Validation
router.post(
  "/add-tickets",
  [
    body("ticketCount")
      .isInt({ min: 1 })
      .withMessage("ticketCount must be a positive integer."),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  addTickets
);

// Protected Route: Start Releasing Tickets with Validation
router.post(
  "/start-release",
  [
    body("ticketsPerRelease")
      .isInt({ min: 1 })
      .withMessage("ticketsPerRelease must be a positive integer."),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  startReleasingTickets
);

// Protected Route: Get Vendor's Tickets
router.get('/my-tickets', getVendorTickets);

// Protected Route: Get Vendor's Released Tickets
router.get('/released-tickets', getVendorReleasedTickets);

// New Route to get total released tickets
router.get('/total-released-tickets', getTotalReleasedTickets);

// New Route to get sold tickets
router.get("/sold-tickets", getVendorSoldTickets);

// Protected Route: Stop Releasing Tickets
router.post("/stop-release", stopReleasingTickets);

// Protected Route: Get Ticket Pool Status
router.get("/ticket-pool", getTicketPoolStatus);

module.exports = router;
