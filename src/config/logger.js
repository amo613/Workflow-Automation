import winston from 'winston';
import { LOG_LEVEL } from '#config/env.js';

const logger = winston.createLogger({
  level: LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'Testing' },
  transports: [
    // Always log to console (for Railway/cloud platforms to see logs)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // Also log to files if logs directory exists
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Function to close logger (useful for tests)
export const closeLogger = async () => {
  return new Promise(resolve => {
    logger.end(() => {
      resolve();
    });
  });
};

export default logger;
