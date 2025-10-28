import winston from 'winston';
import { LOG_LEVEL, NODE_ENV } from '#config/env.js';

const logger = winston.createLogger({
  level: LOG_LEVEL || 'info',
  format: winston.format.combine(
    (winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json())
  ),
  defaultMeta: { service: 'Testing' },
  transports: [
    new winston.transports.File({ filename: 'logs/error', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.simple()),
    })
  );
}

export default logger;
