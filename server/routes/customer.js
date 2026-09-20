const express = require("express");
const router = express.Router();
const { body, param } = require("express-validator");
const customerControllers = require("../controllers/customerControllers");
const { registerCustomer, loginCustomer } = require("../controllers/authController");
const authenticate = require("../middleware/authenticateToken");
const authorizeRole = require("../middleware/authorizeRole");
const { checkCustomerOwnership } = require("../middleware/checkOwnership");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");

// Registration
router.post(
  "/register",
  authLimiter,
  [
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("email").trim().isEmail().withMessage("Please provide a valid email address."),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long."),
    body("mobileNumber")
      .trim()
      .notEmpty()
      .withMessage("Mobile number is required."),
    validate,
  ],
  registerCustomer
);

// Login
router.post(
  "/login",
  authLimiter,
  [
    body("email").trim().isEmail().withMessage("Please provide a valid email address."),
    body("password").notEmpty().withMessage("Password is required."),
    validate,
  ],
  loginCustomer
);

// Available tickets status
router.get("/available-tickets", authenticate, customerControllers.getAvailableTickets);

// Customer details (protected: customer can only view own profile, vendor can view for order verification)
router.get(
  "/:customerId",
  authenticate,
  [
    param("customerId").isMongoId().withMessage("Invalid Customer ID format."),
    validate,
  ],
  checkCustomerOwnership("customerId"),
  customerControllers.getCustomerDetails
);

// Synchronous ticket purchase (protected: customer only, must be own customerId)
router.post(
  "/:customerId/purchase",
  authenticate,
  authorizeRole("customer"),
  [
    param("customerId").isMongoId().withMessage("Invalid Customer ID format."),
    body("quantity")
      .isInt({ min: 1, max: 100 })
      .withMessage("Quantity must be an integer between 1 and 100."),
    validate,
  ],
  checkCustomerOwnership("customerId"),
  customerControllers.purchaseTicket
);

// Customer's purchased tickets
router.get(
  "/:customerId/tickets",
  authenticate,
  authorizeRole("customer", "vendor"),
  [
    param("customerId").isMongoId().withMessage("Invalid Customer ID format."),
    validate,
  ],
  checkCustomerOwnership("customerId"),
  customerControllers.getCustomerTickets
);

// Ticket refund (protected: customer only, must own the ticket)
router.post(
  "/:customerId/refund",
  authenticate,
  authorizeRole("customer"),
  [
    param("customerId").isMongoId().withMessage("Invalid Customer ID format."),
    body("ticketId").isMongoId().withMessage("Invalid Ticket ID format."),
    validate,
  ],
  checkCustomerOwnership("customerId"),
  customerControllers.refundTicket
);

module.exports = router;
