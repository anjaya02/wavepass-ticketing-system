const { validationResult } = require("express-validator");
const { errorResponse } = require("../utils/apiResponse");

/**
 * Middleware to check express-validator results and format clean 400 responses
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));
    return errorResponse(
      res,
      400,
      formattedErrors[0].message,
      "VALIDATION_ERROR",
      formattedErrors
    );
  }
  next();
};

module.exports = validate;
