/**
 * Authentication middleware
 * Handles JWT token extraction, verification, and user attachment
 */

import JWTService from '../services/auth/jwt.service.js';
import User from '../models/User.js';

const jwtService = new JWTService();

/**
 * Extract JWT token from Authorization header
 * @param {Object} req - Express request object
 * @returns {string|null} JWT token or null
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Authenticate middleware - requires valid JWT token
 * Extracts and verifies JWT from Authorization header
 * Attaches user object to req.user
 * Returns 401 if authentication fails
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Verify token
    const verificationResult = jwtService.verifyToken(token);

    if (!verificationResult.valid) {
      // Determine error code based on error message
      let errorCode = 'INVALID_TOKEN';
      if (verificationResult.error && verificationResult.error.includes('expired')) {
        errorCode = 'TOKEN_EXPIRED';
      }

      return res.status(401).json({
        success: false,
        error: {
          code: errorCode,
          message: verificationResult.error || 'Invalid token',
        },
      });
    }

    // Extract wallet address from token payload
    const { walletAddress } = verificationResult.payload;

    // Fetch user from database
    const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'User account is inactive',
        },
      });
    }

    // Attach user to request
    req.user = {
      _id: user._id,
      walletAddress: user.walletAddress,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed',
      },
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if valid token is present, continues without user if not
 * Never returns error - always calls next()
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export async function optionalAuth(req, res, next) {
  try {
    // Extract token from Authorization header
    const token = extractToken(req);

    if (!token) {
      return next();
    }

    // Verify token
    const verificationResult = jwtService.verifyToken(token);

    if (!verificationResult.valid) {
      return next();
    }

    // Extract wallet address from token payload
    const { walletAddress } = verificationResult.payload;

    // Fetch user from database
    const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (!user || !user.isActive) {
      return next();
    }

    // Attach user to request
    req.user = {
      _id: user._id,
      walletAddress: user.walletAddress,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    // Silently fail and continue without user
    next();
  }
}
