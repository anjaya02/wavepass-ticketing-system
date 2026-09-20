const { errorResponse } = require("../utils/apiResponse");

/**
 * Role-Based Access Control (RBAC) middleware.
 * Verifies that the authenticated user possesses one of the allowed roles.
 *
 * @param  {...string} allowedRoles - Array of permitted roles (e.g. 'vendor', 'customer')
 */
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return errorResponse(res, 401, "Authentication required.", "UNAUTHENTICATED");
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        403,
        `Access denied. Requires one of the following roles: [${allowedRoles.join(", ")}].`,
        "FORBIDDEN"
      );
    }

    next();
  };
};

module.exports = authorizeRole;
