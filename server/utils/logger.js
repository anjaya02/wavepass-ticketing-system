const { createLogger, format, transports } = require("winston");

const isProduction = process.env.NODE_ENV === "production";

/**
 * Custom Winston logger with structured formatting and log levels
 */
const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.splat(),
    isProduction ? format.json() : format.combine(format.colorize(), format.simple())
  ),
  defaultMeta: { service: "wavepass-ticketing" },
  transports: [
    new transports.Console({
      silent: process.env.NODE_ENV === "test", // Suppress console noise during automated testing
    }),
  ],
  exitOnError: false,
});

module.exports = logger;
