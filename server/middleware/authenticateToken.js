const jwt = require("jsonwebtoken");
const Customer = require("../models/customer");
const Vendor = require("../models/vendor");
const dotenv = require("dotenv");
const logger = require("../utils/logger");

dotenv.config(); // Load environment variables

const authenticate = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  // Expected format: "Bearer <token>"
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    logger.warn("No token provided for authorization.");
    return res
      .status(401)
      .json({ message: "No token provided, authorization denied." });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user;
    if (decoded.role === "customer") {
      user = await Customer.findById(decoded.id).select("-password"); // Exclude password
      if (!user) {
        logger.warn(`Customer not found: ID ${decoded.id}`);
        return res
          .status(401)
          .json({ message: "Customer not found, authorization denied." });
      }
    } else if (decoded.role === "vendor") {
      user = await Vendor.findById(decoded.id).select("-password"); // Exclude password
      if (!user) {
        logger.warn(`Vendor not found: ID ${decoded.id}`);
        return res
          .status(401)
          .json({ message: "Vendor not found, authorization denied." });
      }
    } else {
      logger.warn(`Invalid user role: ${decoded.role}`);
      return res.status(401).json({ message: "Invalid user role." });
    }

    // Set req.user with necessary fields
    req.user = {
      id: user._id,
      email: user.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      logger.warn("Token has expired.");
      return res.status(401).json({ message: "Token has expired." });
    } else if (error.name === "JsonWebTokenError") {
      logger.warn("Invalid token.");
      return res.status(401).json({ message: "Token is not valid." });
    } else {
      // Log unexpected errors
      logger.error("Unexpected error during token verification:", error);
      return res.status(500).json({ message: "Server error." });
    }
  }
};

module.exports = authenticate;
