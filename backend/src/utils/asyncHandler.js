/**
 * AsyncHandler Utility
 *
 * Wraps async route handlers to catch errors and pass them to Express error middleware.
 * Eliminates the need for try-catch blocks in every controller method.
 *
 * @module utils/asyncHandler
 */

/**
 * Wraps an async function to catch any errors and pass them to next()
 *
 * @param {Function} fn - Async function to wrap (req, res, next) => Promise
 * @returns {Function} Express middleware function
 *
 * @example
 * // Without asyncHandler
 * async function getUser(req, res, next) {
 *   try {
 *     const user = await User.findById(req.params.id);
 *     res.json(user);
 *   } catch (error) {
 *     next(error);
 *   }
 * }
 *
 * // With asyncHandler
 * const getUser = asyncHandler(async (req, res) => {
 *   const user = await User.findById(req.params.id);
 *   res.json(user);
 * });
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;
