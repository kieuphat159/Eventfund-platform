/**
 * Test logger configuration
 * Provides silent logger for tests to reduce noise
 */

import winston from 'winston';

/**
 * Create a silent logger for tests
 * Only logs errors to console, suppresses info/debug logs
 */
export function createTestLogger() {
  return winston.createLogger({
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      // Only log errors to console in test mode
      new winston.transports.Console({
        format: winston.format.simple(),
        silent: process.env.LOG_SILENT === 'true'
      })
    ],
    // Don't exit on error
    exitOnError: false
  });
}

/**
 * Create a completely silent logger (no output)
 */
export function createSilentLogger() {
  return winston.createLogger({
    level: 'error',
    transports: [
      new winston.transports.Console({
        silent: true
      })
    ],
    exitOnError: false
  });
}

export default createTestLogger;
