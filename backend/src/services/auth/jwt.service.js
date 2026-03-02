import jwt from 'jsonwebtoken';
import config from '../../config/env.js';

/**
 * JWTService - JSON Web Token service for session management
 *
 * Responsibilities:
 * - Generate JWT tokens with wallet address and role
 * - Verify JWT token signatures and expiration
 * - Refresh tokens before expiration
 */
class JWTService {
  /**
   * Create JWT service instance
   *
   * @param {string} secret - JWT signing secret (optional, defaults to env config)
   */
  constructor(secret) {
    this.secret = secret || config.jwt.secret;

    if (!this.secret) {
      throw new Error('JWT secret is required');
    }
  }

  /**
   * Generate JWT token with wallet address and role
   *
   * @param {string} walletAddress - Ethereum wallet address
   * @param {string} role - User role (user, organizer, verifier, admin)
   * @returns {string} JWT token
   *
   * Preconditions:
   * - walletAddress is non-null and valid Ethereum address
   * - role is non-null string
   *
   * Postconditions:
   * - Returns valid JWT token string
   * - Token expires in 7 days
   * - Token includes walletAddress and role in payload
   */
  generateToken(walletAddress, role) {
    const normalizedAddress = walletAddress.toLowerCase();

    const payload = {
      walletAddress: normalizedAddress,
      role,
    };

    const token = jwt.sign(payload, this.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    return token;
  }

  /**
   * Verify JWT token signature and expiration
   *
   * @param {string} token - JWT token to verify
   * @returns {{valid: boolean, payload?: object, error?: string}} Verification result
   *
   * Preconditions:
   * - token is non-null string
   *
   * Postconditions:
   * - Returns verification result with payload if valid
   * - Returns error message if invalid or expired
   * - No side effects
   */
  verifyToken(token) {
    try {
      const payload = jwt.verify(token, this.secret);

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message || 'Token verification failed',
      };
    }
  }

  /**
   * Refresh token by issuing new token with same payload
   *
   * @param {string} token - Current JWT token
   * @returns {{valid: boolean, token?: string, error?: string}} Refresh result
   *
   * Preconditions:
   * - token is non-null string
   * - token is valid and not expired
   *
   * Postconditions:
   * - Returns new token with same wallet address and role
   * - New token has new expiration (7 days from now)
   * - Returns error if original token is invalid or expired
   */
  refreshToken(token) {
    try {
      // Verify current token
      const payload = jwt.verify(token, this.secret);

      // Generate new token with same payload
      const newToken = this.generateToken(payload.walletAddress, payload.role);

      return {
        valid: true,
        token: newToken,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message || 'Token refresh failed',
      };
    }
  }
}

export default JWTService;
