/**
 * Error handling middleware
 * Centralized error handler with consistent formatting and logging
 */

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
    message = 'Validation failed';
    details = Object.keys(err.errors).map((key) => ({
      field: key,
      message: err.errors[key].message,
    }));
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
