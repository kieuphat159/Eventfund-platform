import multer from 'multer';
import { BadRequestError } from '../utils/customErrors.js';
import logger from '../config/logger.js';

/**
 * Error handling middleware
 * Centralized error handler with consistent formatting and logging
 */

// Configuration from environment variables
const MAX_IMAGE_SIZE_MB = parseInt(process.env.MAX_IMAGE_SIZE_MB || '5', 10);
const MAX_EVENT_IMAGES = parseInt(process.env.MAX_EVENT_IMAGES || '10', 10);

/**
 * Error handler middleware
 * Formats errors consistently and logs with context
 * Never exposes internal error details to clients
 *
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function errorHandler(err, req, res, next) {
  // Handle Multer errors first
  if (err instanceof multer.MulterError) {
    logger.warn('Multer error', {
      code: err.code,
      field: err.field,
      message: err.message
    });

    let statusCode = 400;
    let errorCode = 'UPLOAD_ERROR';
    let message = 'File upload error';
    let details = [err.message];

    // Handle specific multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      errorCode = 'FILE_SIZE_EXCEEDED';
      message = `File size exceeds ${MAX_IMAGE_SIZE_MB}MB limit`;
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      errorCode = 'TOO_MANY_FILES';
      message = 'Too many files';
      details = [`Maximum ${MAX_EVENT_IMAGES} images allowed`];
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      errorCode = 'UNEXPECTED_FIELD';
      message = 'Unexpected field';
      details = [`Unexpected file field: ${err.field}`];
    }

    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: message,
        details: details
      }
    });
  }

  // Handle custom image validation errors
  if (err.code === 'INVALID_IMAGE_FORMAT' || err.code === 'FILE_TYPE_MISMATCH') {
    return res.status(400).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details || [err.message]
      }
    });
  }

  // Default error values
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || undefined;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    details = Object.keys(err.errors).map((key) => ({
      field: key,
      message: err.errors[key].message,
    }));
    // Use first error message as main message if only one error
    message = details.length === 1 ? details[0].message : 'Validation failed';
  } else if (err.name === 'MongoError' && err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 400;
    errorCode = 'DUPLICATE_KEY';
    message = 'Resource already exists';
  } else if (err.name === 'CastError') {
    // MongoDB cast error (invalid ObjectId)
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = 'Invalid resource ID';
  } else if (statusCode === 500) {
    // Don't expose internal error details
    message = 'An unexpected error occurred';
    errorCode = 'INTERNAL_SERVER_ERROR';
  }

  // Log error with context
  const logMessage = `[ERROR] ${req.method} ${req.url} - ${errorCode}: ${err.message}`;
  console.error(logMessage);
  console.error('Stack:', err.stack);
  console.error('User:', req.user ? req.user.walletAddress : 'Anonymous');
  console.error('Params:', req.params);
  console.error('Query:', req.query);
  console.error('Body:', req.body);

  // Send error response
  const response = {
    success: false,
    error: {
      code: errorCode,
      message: message,
    },
  };

  // Include details if present (e.g., validation errors)
  if (details) {
    response.error.details = details;
  }

  res.status(statusCode).json(response);
}

/**
 * Not found handler middleware
 * Returns 404 for unknown routes
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
}
