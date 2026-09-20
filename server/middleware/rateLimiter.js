const rateLimit = require("express-rate-limit");
const { errorResponse } = require("../utils/apiResponse");

/**
 * Rate limiter for authentication endpoints (login / register)
 * In test environment, it allows high throughput without blocking test runners.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "test" ? 10000 : 100, // limit each IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(
      res,
      429,
      "Too many requests from this IP. Please try again after 15 minutes.",
      "RATE_LIMIT_EXCEEDED"
    );
  },
});

module.exports = {
  authLimiter,
};
