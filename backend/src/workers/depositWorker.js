import logger from "../config/logger.js";
import { connectDB } from "../config/database.js";

/**
 * Deposit Worker
 * Processes deposit orders in the background
 */

async function startWorker() {
  try {
    // Connect to database
    await connectDB();

    logger.info("Deposit worker started");

    // Deposit processing is triggered from the VNPay callbacks.
    // This worker keeps the process alive so the npm script remains valid.

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, closing deposit worker gracefully");
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.info("SIGINT received, closing deposit worker gracefully");
      process.exit(0);
    });
  } catch (error) {
    logger.error("Failed to start deposit worker", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

startWorker();
