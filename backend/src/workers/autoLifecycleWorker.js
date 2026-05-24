import config from "../config/env.js";
import logger from "../config/logger.js";
import { connectDB, disconnectDB } from "../config/mongoDB.js";
import {
  startAutoEventLifecycleService,
  stopAutoEventLifecycleService,
} from "../services/events/autoLifecycle.service.js";

let shuttingDown = false;

async function startWorker() {
  try {
    logger.info("Auto lifecycle worker starting", {
      nodeVersion: process.version,
      environment: config.nodeEnv,
    });

    logger.info("Connecting to MongoDB...");
    await connectDB();
    logger.info("MongoDB connected successfully");

    const timer = startAutoEventLifecycleService({ logger });
    if (!timer) {
      throw new Error("Auto lifecycle worker is disabled by configuration");
    }

    logger.info("Auto lifecycle worker started successfully");
  } catch (error) {
    logger.error("Failed to start auto lifecycle worker", {
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} signal received: starting graceful shutdown`);

  try {
    stopAutoEventLifecycleService();
    logger.info("Auto lifecycle timer stopped");

    logger.info("Disconnecting from MongoDB...");
    await disconnectDB();
    logger.info("MongoDB disconnected");

    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during graceful shutdown", {
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection", {
    reason,
  });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", {
    error: {
      message: error.message,
      stack: error.stack,
    },
  });
  process.exit(1);
});

await startWorker();
