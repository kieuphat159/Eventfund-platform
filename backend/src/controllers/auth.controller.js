import NonceService from '../services/auth/nonce.service.js';
import SIWEService from '../services/auth/siwe.service.js';
import JWTService from '../services/auth/jwt.service.js';
import config from '../config/env.js';
import { isValidAddress } from '../utils/address.js';

/**
 * AuthController - Handles authentication endpoints
 *
 * Endpoints:
 * - POST /auth/nonce - Generate nonce for wallet
 * - POST /auth/verify - Verify SIWE signature and issue JWT
 * - POST /auth/logout - Logout user
 * - POST /auth/refresh - Refresh JWT token
 */
class AuthController {
  constructor() {
    this.nonceService = new NonceService();
    this.siweService = new SIWEService();
    this.jwtService = new JWTService(config.jwt.secret);
  }

  /**
   * POST /auth/nonce
   * Generate nonce for wallet authentication
   *
   * @param {object} req - Express request
   * @param {object} res - Express response
   * @param {function} next - Express next middleware
   *
   * Request body:
   * - walletAddress: string (required)
   *
   * Response:
   * - 200: { success: true, data: { nonce, expiresAt } }
   * - 400: Invalid wallet address
   * - 500: Server error
   */
  async getNonce(req, res, next) {
    try {
      const { walletAddress } = req.validated?.body || req.body;

      // Validate wallet address
      if (!walletAddress) {
        const error = new Error('Wallet address is required');
        error.statusCode = 400;
        return next(error);
      }

      if (!isValidAddress(walletAddress)) {
        const error = new Error('Invalid Ethereum address format');
        error.statusCode = 400;
        return next(error);
      }

      // Generate nonce
      const result = await this.nonceService.generateNonce(walletAddress);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/message
   * Create SIWE message for wallet signing
   *
   * @param {object} req - Express request
   * @param {object} res - Express response
   * @param {function} next - Express next middleware
   *
   * Request body:
   * - walletAddress: string (required)
   * - chainId: number (optional, defaults to config)
   *
   * Response:
   * - 200: { success: true, data: { message, nonce } }
   * - 400: Invalid wallet address or nonce not found
   * - 500: Server error
   */
  async getMessage(req, res, next) {
    try {
      const { walletAddress, chainId } = req.validated?.body || req.body;

      // Validate wallet address
      if (!walletAddress) {
        const error = new Error('Wallet address is required');
        error.statusCode = 400;
        return next(error);
      }

      if (!isValidAddress(walletAddress)) {
        const error = new Error('Invalid Ethereum address format');
        error.statusCode = 400;
        return next(error);
      }

      // Get existing nonce for this wallet
      const nonceData = await this.nonceService.getNonce(walletAddress);
      if (!nonceData) {
        const error = new Error('No nonce found. Please request a nonce first by calling POST /auth/nonce');
        error.statusCode = 400;
        error.code = 'NONCE_NOT_FOUND';
        return next(error);
      }

      // Create SIWE message
      const message = this.siweService.createSIWEMessage(
        walletAddress,
        nonceData.nonce,
        config.siwe.domain,
        config.siwe.uri,
        chainId || config.siwe.chainId
      );

      res.status(200).json({
        success: true,
        data: {
          message,
          nonce: nonceData.nonce,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/verify
   * Verify SIWE signature and issue JWT token
   *
   * @param {object} req - Express request
   * @param {object} res - Express response
   * @param {function} next - Express next middleware
   *
   * Request body:
   * - message: string (SIWE message, required)
   * - signature: string (wallet signature, required)
   *
   * Response:
   * - 200: { success: true, data: { token, user } }
   * - 400: Invalid message format
   * - 401: Invalid signature or expired nonce
   * - 500: Server error
   */
  async verifySignature(req, res, next) {
    try {
      const { message, signature } = req.validated.body;

      // Validate inputs
      if (!message || !signature) {
        const error = new Error('Message and signature are required');
        error.statusCode = 400;
        return next(error);
      }

      // Parse SIWE message
      const parseResult = this.siweService.parseSIWEMessage(message);
      if (!parseResult.valid) {
        const error = new Error(parseResult.error || 'Invalid SIWE message format');
        error.statusCode = 400;
        return next(error);
      }

      const { address: walletAddress, nonce } = parseResult.parsed;

      // Verify signature
      const verifyResult = await this.siweService.verifySIWE(message, signature);
      if (!verifyResult.valid) {
        const error = new Error(verifyResult.error || 'Invalid signature');
        error.statusCode = 401;
        return next(error);
      }

      // Validate nonce
      const nonceResult = await this.nonceService.validateNonce(walletAddress, nonce);
      if (!nonceResult.valid) {
        const error = new Error(nonceResult.error || 'Invalid nonce');
        error.statusCode = 401;
        return next(error);
      }

      // Invalidate nonce (one-time use)
      await this.nonceService.invalidateNonce(walletAddress);

      // Generate JWT token
      const token = this.jwtService.generateToken(
        nonceResult.user.walletAddress,
        nonceResult.user.role
      );

      res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            walletAddress: nonceResult.user.walletAddress,
            role: nonceResult.user.role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/logout
   * Logout user (client-side token removal)
   *
   * @param {object} req - Express request
   * @param {object} res - Express response
   * @param {function} next - Express next middleware
   *
   * Response:
   * - 200: { success: true, message: 'Logged out successfully' }
   * - 401: Not authenticated
   */
  async logout(req, res, next) {
    try {
      // Check if user is authenticated
      if (!req.user) {
        const error = new Error('Not authenticated');
        error.statusCode = 401;
        return next(error);
      }

      // JWT is stateless, so logout is handled client-side by removing token
      // In future, could implement token blacklist with Redis

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/refresh
   * Refresh JWT token before expiration
   *
   * @param {object} req - Express request
   * @param {object} res - Express response
   * @param {function} next - Express next middleware
   *
   * Request body:
   * - token: string (current JWT token, required)
   *
   * Response:
   * - 200: { success: true, data: { token } }
   * - 400: Token is required
   * - 401: Invalid or expired token
   * - 500: Server error
   */
  async refreshToken(req, res, next) {
    try {
      const { token } = req.body;

      // Validate input
      if (!token) {
        const error = new Error('Token is required');
        error.statusCode = 400;
        return next(error);
      }

      // Refresh token
      const result = this.jwtService.refreshToken(token);
      if (!result.valid) {
        const error = new Error(result.error || 'Token refresh failed');
        error.statusCode = 401;
        return next(error);
      }

      res.status(200).json({
        success: true,
        data: {
          token: result.token,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
