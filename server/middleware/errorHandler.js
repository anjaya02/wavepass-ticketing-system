const logger = require("../utils/logger");
const { errorResponse } = require("../utils/apiResponse");

/**
 * Centralized error-handling middleware.
 * Formats errors into consistent JSON responses and guards against leaking sensitive internals.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let code = err.code || "INTERNAL_SERVER_ERROR";
  let message = err.message || "An unexpected error occurred.";
  let details = err.details || null;

  // Handle Mongoose CastError (e.g. invalid MongoDB ObjectId format)
  if (err.name === "CastError") {
    statusCode = 400;
    code = "INVALID_ID";
    message = `Invalid format for field '${err.path}': '${err.value}'.`;
  }

  // Handle Mongoose Duplicate Key error (MongoDB error 11000)
  if (err.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_RESOURCE";
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `A resource with that ${field} already exists.`;
  }

  // Handle Mongoose Validation Errors
  if (err.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    const validationErrors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = validationErrors[0]?.message || "Validation failed.";
    details = validationErrors;
  }

  // Log unexpected server errors
  if (statusCode >= 500) {
    logger.error("Unhandled Server Error: %s\nStack: %s", err.message, err.stack);
    if (process.env.NODE_ENV === "production") {
      message = "An unexpected internal server error occurred. Please try again later.";
    }
  } else {
    logger.warn(`Operational error [${statusCode} ${code}]: ${message}`);
  }

  return errorResponse(res, statusCode, message, code, details);
};

module.exports = errorHandler;