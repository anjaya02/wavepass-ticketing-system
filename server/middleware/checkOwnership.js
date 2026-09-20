const { errorResponse } = require("../utils/apiResponse");

/**
 * Resource ownership verification middleware.
 * Ensures a customer can only access or modify their own resource.
 */
const checkCustomerOwnership = (paramName = "customerId") => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, "Authentication required.", "UNAUTHENTICATED");
    }

    const requestedCustomerId = req.params[paramName];
    if (!requestedCustomerId) {
      return next();
    }

    if (req.user.role === "customer" && req.user.id.toString() !== requestedCustomerId.toString()) {
      return errorResponse(
        res,
        403,
        "Access denied. You cannot access or modify another customer's resources.",
        "FORBIDDEN"
      );
    }

    next();
  };
};

module.exports = {
  checkCustomerOwnership,
};
