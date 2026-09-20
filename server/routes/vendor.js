const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const {
  registerVendor,
  loginVendor,
} = require("../controllers/authController");
const {
  addTickets,
  startReleasingTickets,
  stopReleasingTickets,
  deleteAvailableTickets,
  getVendorTickets,
  getVendorReleasedTickets,
  getTotalReleasedTickets,
  getVendorSoldTickets,
  getTicketPoolStatus,
} = require("../controllers/vendorControllers");
const authenticate = require("../middleware/authenticateToken");
const authorizeRole = require("../middleware/authorizeRole");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");

// Vendor Registration
router.post(
  "/register",
  authLimiter,
  [
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("email").trim().isEmail().withMessage("Please provide a valid email address."),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long."),
    validate,
  ],
  registerVendor
);

// Vendor Login
router.post(
  "/login",
  authLimiter,
  [
    body("email").trim().isEmail().withMessage("Please provide a valid email address."),
    body("password").notEmpty().withMessage("Password is required."),
    validate,
  ],
  loginVendor
);

// All routes below require authentication and vendor role
router.use(authenticate);
router.use(authorizeRole("vendor"));

// Add tickets directly (batch release)
router.post(
  "/add-tickets",
  [
    body("ticketCount")
      .isInt({ min: 1, max: 1000 })
      .withMessage("ticketCount must be an integer between 1 and 1000."),
    validate,
  ],
  addTickets
);

// Start automated periodic release
router.post(
  "/start-release",
  [
    body("ticketsPerRelease")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("ticketsPerRelease must be a positive integer."),
    validate,
  ],
  startReleasingTickets
);

// Stop automated periodic release
router.post("/stop-release", stopReleasingTickets);

// Delete available tickets from pool
router.delete("/delete-available-tickets", deleteAvailableTickets);

// Vendor metrics and tickets
router.get("/my-tickets", getVendorTickets);
router.get("/released-tickets", getVendorReleasedTickets);
router.get("/total-released-tickets", getTotalReleasedTickets);
router.get("/sold-tickets", getVendorSoldTickets);
router.get("/ticket-pool", getTicketPoolStatus);

module.exports = router;
