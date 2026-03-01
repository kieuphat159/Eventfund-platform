import app from './app.js';
import config from './config/env.js';
import logger from './config/logger.js';
// import { connectDB } from './config/mongoDB.js';

const PORT = config.port;

// Log application startup
logger.info('Application starting', {
  nodeVersion: process.version,
  environment: config.nodeEnv,
  port: PORT
});

app.listen(PORT, () => {
  logger.info(`Backend running at http://localhost:${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
});

// Future: Connect to MongoDB
// connectDB().then(() => {
//   app.listen(PORT, () => {
//     logger.info(`Backend running at http://localhost:${PORT}`);
//     logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
//   });
// }).catch((error) => {
//   logger.error('Failed to connect to MongoDB', { error: error.message });
//   process.exit(1);
// });

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: {
      message: error.message,
      stack: error.stack
    }
  });
  process.exit(1);
});