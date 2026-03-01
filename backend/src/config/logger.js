import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './env.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  // Add stack trace for errors
  if (stack) {
    msg += `\n${stack}`;
  }

  // Add metadata if present
  const metaKeys = Object.keys(metadata);
  if (metaKeys.length > 0 && metaKeys[0] !== 'Symbol(level)') {
    msg += `\n${JSON.stringify(metadata, null, 2)}`;
  }

  return msg;
});

// Create logger instance
const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
  ),
  defaultMeta: {
    service: 'eventfund-backend',
    environment: config.nodeEnv
  },
  transports: []
});

// Console transport for development
if (config.isDev || config.isTest) {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      consoleFormat
    )
  }));
}

// File transports for production
if (config.isProd) {
  // Create logs directory path
  const logsDir = path.join(__dirname, '../../logs');

  // Error log file
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: json(),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  // Combined log file
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: json(),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  // Console with JSON format for production
  logger.add(new winston.transports.Console({
    format: json()
  }));
}

// Create stream for Morgan HTTP logger
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

export default logger;
