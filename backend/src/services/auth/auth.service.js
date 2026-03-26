import { BadRequestError, UnauthorizedError } from '../../utils/customErrors.js';
import User from '../../models/User.model.js';
import jwt from 'jsonwebtoken';

/**
 * AuthService - Handles authentication business logic
 */
class AuthService {
  constructor(nonceService, siweService, jwtService) {
    this.nonceService = nonceService;
    this.siweService = siweService;
    this.jwtService = jwtService;
  }

  /**
   * Generate nonce for wallet address
   */
  async generateNonce(walletAddress) {
    return await this.nonceService.generateNonce(walletAddress);
  }

  /**
   * Get nonce for wallet address
   */
  async getNonce(walletAddress) {
    return await this.nonceService.getNonce(walletAddress);
  }

  /**
   * Create SIWE message
   */
  createSIWEMessage(walletAddress, nonce, domain, uri, chainId) {
    return this.siweService.createSIWEMessage(walletAddress, nonce, domain, uri, chainId);
  }

  /**
   * Login with Web3Auth ID token
   */
  async loginWithIdToken(idToken, walletAddress) {
    const decoded = jwt.decode(idToken);
    if (!decoded) {
      throw new BadRequestError('Invalid ID Token format');
    }

    // find or create user with walletAddress
    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (!user) {
      user = await User.create({
        walletAddress: walletAddress.toLowerCase(),
        email: decoded.email,
        username: decoded.name || 'User',
        avatarUrl: decoded.profileImage,
        role: 'user'
      });
    }

    // Generate session JWT token
    const token = this.jwtService.generateToken(user.walletAddress, user.role);

    return {
      token,
      user: {
        walletAddress: user.walletAddress,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: user.role
      }
    };
  }

  /**
   * Verify signature and authenticate user
   * Consolidates the entire authentication flow
   */
  async verifyAndAuthenticate(message, signature) {
    // Parse SIWE message
    const parseResult = this.siweService.parseSIWEMessage(message);
    if (!parseResult.valid) {
      throw new BadRequestError(parseResult.error || 'Invalid SIWE message format');
    }

    const { address: walletAddress, nonce } = parseResult.parsed;

    // Verify signature
    const verifyResult = await this.siweService.verifySIWE(message, signature);
    if (!verifyResult.valid) {
      throw new UnauthorizedError(verifyResult.error || 'Invalid signature');
    }

    // Validate nonce
    const nonceResult = await this.nonceService.validateNonce(walletAddress, nonce);
    if (!nonceResult.valid) {
      throw new UnauthorizedError(nonceResult.error || 'Invalid nonce');
    }

    // Invalidate used nonce
    await this.nonceService.invalidateNonce(walletAddress);

    // Generate JWT token
    const token = this.jwtService.generateToken(
      nonceResult.user.walletAddress,
      nonceResult.user.role
    );

    return {
      token,
      user: {
        walletAddress: nonceResult.user.walletAddress,
        role: nonceResult.user.role
      }
    };
  }

  /**
   * Refresh JWT token
   */
  refreshToken(token) {
    const result = this.jwtService.refreshToken(token);
    if (!result.valid) {
      throw new UnauthorizedError(result.error || 'Token refresh failed');
    }
    return result.token;
  }
}

export default AuthService;
