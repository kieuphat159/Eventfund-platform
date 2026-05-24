import config from "../config/env.js";
import logger from "../config/logger.js";
import { connectDB, disconnectDB } from "../config/mongoDB.js";
import { runMarketplaceIndexerLoop } from "../services/blockchain/indexers/marketplace/indexer.js";
import { runMarketplaceProcessorLoop } from "../services/blockchain/processors/marketplace.processor.js";

let shuttingDown = false;

async function startWorker() {
  try {
    logger.info("Marketplace sync worker starting", {
      nodeVersion: process.version,
      environment: config.nodeEnv,
    });

    logger.info("Connecting to MongoDB...");
    await connectDB();
    logger.info("MongoDB connected successfully");

    void runMarketplaceIndexerLoop().catch((error) => {
      logger.error("Marketplace indexer crashed", {
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
      process.exit(1);
    });

    void runMarketplaceProcessorLoop().catch((error) => {
      logger.error("Marketplace processor crashed", {
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
      process.exit(1);
    });

    logger.info("Marketplace sync worker started successfully");
  } catch (error) {
    logger.error("Failed to start marketplace sync worker", {
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
