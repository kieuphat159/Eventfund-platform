/**
 * Role-based access control middleware
 * Enforces role requirements on protected endpoints
 */

/**
 * Require specific role(s) to access endpoint
 * Admin role always has access to all endpoints
 *
 * @param {...string} roles - Required roles (user, organizer, verifier, admin)
 * @returns {Function} Express middleware function
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Admin role has access to everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    }

    next();
  };
}

/**
 * Require organizer or admin role
 * Convenience helper for organizer-only endpoints
 */
export const requireOrganizer = requireRole('organizer', 'admin');

/**
 * Require verifier or admin role
 * Convenience helper for verifier-only endpoints
 */
export const requireVerifier = requireRole('verifier', 'admin');

/**
 * Require admin role
 * Convenience helper for admin-only endpoints
 */
export const requireAdmin = requireRole('admin');
