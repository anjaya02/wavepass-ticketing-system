const { createLogger, format, transports } = require("winston");

const logger = createLogger({
  level: "info", // Set the minimum level to log
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    format.errors({ stack: true }), 
    format.splat(),
    format.json()
  ),
  transports: [new transports.Console()],
  exitOnError: false, // Do not exit on handled exceptions
});

module.exports = logger;
