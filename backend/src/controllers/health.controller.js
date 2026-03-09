import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';

/**
 * HealthController - Handles health check endpoints
 *
 * Endpoints:
 * - GET /health - Basic health check (public)
 * - GET /health/db - Database health check (public)
 */
class HealthController {
  /**
   * GET /health
   * Basic health check endpoint
   *
   * @param {object} req - Express request
   * @param {object} res - Express response
   * @param {function} next - Express next middleware
   *
   * Response:
   * - 200: { success: true, data: { status, version, uptime, timestamp } }
   */
  healthCheck = asyncHandler(async (req, res) => {
    const uptime = process.uptime();
    const version = process.env.npm_package_version || '1.0.0';

    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        version,
        uptime: Math.floor(uptime),
        timestamp: new Date()
      }
    });
  });

  /**
   * GET /health/db
   * Database health check endpoint
   *
   * @param {object} req - Express request
   * @param {object} res - Express response
   * @param {function} next - Express next middleware
   *
   * Response:
   * - 200: { success: true, data: { database, status, timestamp } }
   * - 503: Database unavailable
   */
  databaseHealth = asyncHandler(async (req, res, next) => {
    // Check database connection state
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const dbState = mongoose.connection.readyState;

    if (dbState !== 1) {
      const error = new Error('Database unavailable');
      error.statusCode = 503;
      return next(error);
    }

    res.status(200).json({
      success: true,
      data: {
        database: 'connected',
        status: 'healthy',
        timestamp: new Date()
      }
    });
  });
}

export default HealthController;
