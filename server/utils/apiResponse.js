/**
 * Standard API Response utilities for consistent HTTP payloads
 */
const successResponse = (res, statusCode = 200, message = "Success", data = null) => {
  const payload = {
    success: true,
    message,
  };
  if (data !== null && data !== undefined) {
    // If data has properties we can merge or place under data key
    payload.data = data;
    // For backwards-compatibility with existing frontend expecting top-level fields
    if (typeof data === "object" && !Array.isArray(data)) {
      Object.assign(payload, data);
    }
  }
  return res.status(statusCode).json(payload);
};

const errorResponse = (res, statusCode = 500, message = "An error occurred", code = "ERROR", details = null) => {
  const payload = {
    success: false,
    error: {
      code,
      message,
    },
    // Backwards compatibility for frontend checking message directly
    message,
  };
  if (details) {
    payload.error.details = details;
  }
  return res.status(statusCode).json(payload);
};

module.exports = {
  successResponse,
  errorResponse,
};
