import { BadRequestError, UnauthorizedError } from '../../utils/customErrors.js';

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
