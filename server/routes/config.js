const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const configController = require("../controllers/configController");

// Route to set configuration parameters
router.post(
  "/set",
  [
    body("totalTickets")
      .isInt({ min: 1 })
      .withMessage("Total Tickets must be a positive integer."),
    body("ticketReleaseRate")
      .isInt({ min: 1 })
      .withMessage("Ticket Release Rate must be a positive integer (ms)."),
    body("customerRetrievalRate")
      .isInt({ min: 1 })
      .withMessage("Customer Retrieval Rate must be a positive integer (ms)."),
    body("maxTicketCapacity")
      .isInt({ min: 1 })
      .withMessage("Max Ticket Capacity must be a positive integer."),
  ],
  async (req, res) => {
    // Validate inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Extract data
    const {
      totalTickets,
      ticketReleaseRate,
      customerRetrievalRate,
      maxTicketCapacity,
    } = req.body;

    // Ensure maxTicketCapacity < totalTickets
    if (maxTicketCapacity >= totalTickets) {
      return res.status(400).json({
        message: "Max Ticket Capacity must be less than Total Tickets.",
      });
    }

    try {
      await configController.setConfiguration({
        totalTickets,
        ticketReleaseRate,
        customerRetrievalRate,
        maxTicketCapacity,
      });
      res.status(200).json({ message: "Configuration updated successfully." });
    } catch (error) {
      console.error("Error setting configuration:", error);
      res.status(500).json({
        message: "Error setting configuration.",
        error: error.message,
      });
    }
  }
);

// Endpoint to get customer retrieval rate
router.get('/customer-retrieval-rate', async (req, res) => {
  try {
    const configuration = await configController.getConfiguration();
    if (!configuration) {
      return res.status(404).json({ message: 'Configuration not found.' });
    }
    res.json({ customerRetrievalRate: configuration.customerRetrievalRate });
  } catch (error) {
    console.error("Error fetching customer retrieval rate:", error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const configuration = await configController.getConfiguration();

    if (!configuration) {
      // Return 404 Not Found if configuration doesn't exist
      return res.status(404).json({ message: "Configuration not found." });
    }

    res.status(200).json(configuration);
  } catch (error) {
    console.error("Error fetching configuration:", error);
    res.status(500).json({
      message: "Error fetching configuration.",
      error: error.message,
    });
  }
});

// Route to reset configuration to default
router.post("/reset", async (req, res) => {
  try {
    await configController.resetConfiguration();
    res
      .status(200)
      .json({ message: "Configuration reset to default successfully." });
  } catch (error) {
    console.error("Error resetting configuration:", error);
    res.status(500).json({
      message: "Error resetting configuration.",
      error: error.message,
    });
  }
});

module.exports = router;
