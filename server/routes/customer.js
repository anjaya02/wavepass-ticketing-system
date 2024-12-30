const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator"); 
const customerControllers = require("../controllers/customerControllers");
const authenticate = require("../middleware/authenticateToken");

// Customer Registration with Validation
router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name is required."),
    body("email").isEmail().withMessage("Please provide a valid email."),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long."),
    body("mobileNumber")
      .matches(/^\+?\d{10,15}$/)
      .withMessage("Please provide a valid mobile number."),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  customerControllers.registerCustomer
);

router.post("/login", customerControllers.loginCustomer);
router.get(
  "/available-tickets",
  authenticate, 
  customerControllers.getAvailableTickets
);

// Protected Routes (Require Authentication)
router.get(
  "/:customerId",
  authenticate,
  customerControllers.getCustomerDetails
);
router.post(
  "/:customerId/purchase",
  authenticate,
  customerControllers.purchaseTicket
);
router.get(
  "/:customerId/tickets",
  authenticate,
  customerControllers.getCustomerTickets
);
router.post(
  "/:customerId/refund",
  authenticate,
  customerControllers.refundTicket
);

module.exports = router;
