const winston = require("winston")
const logger = winston.createLogger({
  transports: [
      new winston.transports.Console({
          handleExceptions: true // Catch unhandled exceptions and log them
      })
  ],
  levels: {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      verbose: 4,
      debug: 5,
      silly: 6
  },
  level: process.env.LOG_LEVEL || "silly", // Log everything, except when in production when only do info and lower
  exitOnError: true,
  format: winston.format.combine(
      winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss"
      }),
      winston.format.errors({ stack: true }),
      winston.format.json()
  )
})
module.exports = logger