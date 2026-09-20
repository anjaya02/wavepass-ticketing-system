const jwt = require("jsonwebtoken");
const Customer = require("../models/customer");
const Vendor = require("../models/vendor");
const logger = require("../utils/logger");
const { errorResponse } = require("../utils/apiResponse");

/**
 * Authentication middleware that verifies the JWT token and attaches
 * the authenticated user identity to `req.user`.
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return errorResponse(
      res,
      401,
      "Access denied. No authentication token provided.",
      "UNAUTHENTICATED"
    );
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user;
    if (decoded.role === "customer") {
      user = await Customer.findById(decoded.id).select("-password");
      if (!user) {
        return errorResponse(res, 401, "Customer account not found or deactivated.", "USER_NOT_FOUND");
      }
    } else if (decoded.role === "vendor") {
      user = await Vendor.findById(decoded.id).select("-password");
      if (!user) {
        return errorResponse(res, 401, "Vendor account not found or deactivated.", "USER_NOT_FOUND");
      }
    } else {
      return errorResponse(res, 401, "Invalid token role.", "INVALID_ROLE");
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return errorResponse(res, 401, "Authentication token has expired.", "TOKEN_EXPIRED");
    }
    if (error.name === "JsonWebTokenError") {
      return errorResponse(res, 401, "Invalid authentication token.", "INVALID_TOKEN");
    }

    logger.error("Unexpected error during token verification:", error);
    return errorResponse(res, 500, "Internal server error during authentication.", "INTERNAL_SERVER_ERROR");
  }
};

module.exports = authenticateToken;
