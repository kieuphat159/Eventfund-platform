/**
 * EventFund Platform - Backend Server
 * 
 * 
 * 
 * 
 */

import app from './app.js';
import config from './config/env.js';
import logger from './config/logger.js';
import { connectDB, disconnectDB } from './config/mongoDB.js';
import {
  startAutoEventLifecycleService,
  stopAutoEventLifecycleService,
} from "./services/events/autoLifecycle.service.js";
const PORT = config.port;
import "./config/env.js";

// Store server instance for graceful shutdown
let server;

/**
 * Start the server
 */
async function startServer() {
  try {
    // Log application startup
    logger.info('Application starting', {
      nodeVersion: process.version,
      environment: config.nodeEnv,
      port: PORT
    });

    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await connectDB();
    logger.info('MongoDB connected successfully');

    startAutoEventLifecycleService({ logger });

    // TODO: Connect to Redis when rate limiting is implemented
    // logger.info('Connecting to Redis...');
    // await connectRedis();
    // logger.info('Redis connected successfully');

    // Start Express server
    server = app.listen(PORT, () => {
      logger.info(`Backend running at http://localhost:${PORT}`);
      logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
      logger.info('Server started successfully');
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  logger.info(`${signal} signal received: starting graceful shutdown`);

  try {
    // Close HTTP server
    if (server) {
      logger.info('Closing HTTP server...');
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info('HTTP server closed');
    }

    // Disconnect from MongoDB
    stopAutoEventLifecycleService();
    logger.info('Disconnecting from MongoDB...');
    await disconnectDB();
    logger.info('MongoDB disconnected');

    // TODO: Disconnect from Redis when implemented
    // logger.info('Disconnecting from Redis...');
    // await disconnectRedis();
    // logger.info('Redis disconnected');

    logger.info('Graceful shutdown completed');
    process.exit(0);

  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    process.exit(1);
  }
}

// Handle graceful shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
  // In development, keep server alive for easier debugging.
  // In production, exit so the process manager can restart cleanly.
  if (config.isProd) {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: {
      message: error.message,
      stack: error.stack
    }
  });
  // Exit on uncaught exception as the process is in an undefined state
  process.exit(1);
});

// Start the server
startServer();
