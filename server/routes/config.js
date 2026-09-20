const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const configController = require("../controllers/configController");
const authenticate = require("../middleware/authenticateToken");
const authorizeRole = require("../middleware/authorizeRole");
const validate = require("../middleware/validate");

// Get current system configuration (public/accessible)
router.get("/", configController.getConfiguration);

// Endpoint to get customer retrieval rate
router.get("/customer-retrieval-rate", configController.getConfiguration);

// Update configuration (restricted to vendor/admin)
router.post(
  "/set",
  authenticate,
  authorizeRole("vendor"),
  [
    body("totalTickets")
      .isInt({ min: 1 })
      .withMessage("Total Tickets must be a positive integer."),
    body("ticketReleaseRate")
      .isInt({ min: 100 })
      .withMessage("Ticket Release Rate must be at least 100 ms."),
    body("customerRetrievalRate")
      .isInt({ min: 100 })
      .withMessage("Customer Retrieval Rate must be at least 100 ms."),
    body("maxTicketCapacity")
      .isInt({ min: 1 })
      .withMessage("Max Ticket Capacity must be a positive integer."),
    validate,
  ],
  configController.setConfiguration
);

// Reset configuration to default (restricted to vendor/admin)
router.post(
  "/reset",
  authenticate,
  authorizeRole("vendor"),
  configController.resetConfiguration
);

module.exports = router;
