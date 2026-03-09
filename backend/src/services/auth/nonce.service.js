import crypto from 'crypto';
import User from '../../models/User.model.js';
import { AUTH_CONSTANTS } from '../../constants/auth.constants.js';

/**
 * NonceService - Manages cryptographic nonces for SIWE authentication
 */
class NonceService {
  async generateNonce(walletAddress) {
    // Validate wallet address
    if (!walletAddress) {
      const error = new Error('Wallet address is required');
      error.statusCode = 400;
      throw error;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      const error = new Error('Invalid Ethereum address format');
      error.statusCode = 400;
      throw error;
    }

    const normalizedAddress = walletAddress.toLowerCase();

    // Generate cryptographically secure random nonce
    const nonce = crypto.randomBytes(AUTH_CONSTANTS.NONCE_BYTES).toString('hex');

    // Set expiration using constant
    const expiresAt = new Date(Date.now() + AUTH_CONSTANTS.NONCE_EXPIRY_MS);

    try {
      // Find or create user
      let user = await User.findOne({ walletAddress: normalizedAddress });

      if (!user) {
        // Create new user with nonce
        user = new User({
          walletAddress: normalizedAddress,
          nonce,
          nonceExpiresAt: expiresAt,
        });
        console.log('[NonceService] Creating new user:', normalizedAddress);
      } else {
        // Update existing user with new nonce
        user.nonce = nonce;
        user.nonceExpiresAt = expiresAt;
        console.log('[NonceService] Updating existing user:', normalizedAddress);
      }

      await user.save();

      return {
        nonce,
        expiresAt,
      };
    } catch (error) {
      console.error('[NonceService] Error generating nonce:', error.message);
      console.error('[NonceService] Wallet address:', normalizedAddress);
      console.error('[NonceService] Error code:', error.code);
      console.error('[NonceService] Error name:', error.name);
      console.error('[NonceService] Full error:', error);
      throw error;
    }
  }

  async validateNonce(walletAddress, nonce) {
    const normalizedAddress = walletAddress.toLowerCase();

    // Find user
    const user = await User.findOne({ walletAddress: normalizedAddress });

    if (!user) {
      return {
        valid: false,
        error: 'User not found',
      };
    }

    // Check nonce match
    if (user.nonce !== nonce) {
      return {
        valid: false,
        error: 'Invalid nonce',
      };
    }

    // Check expiration
    if (user.nonceExpiresAt < new Date()) {
      return {
        valid: false,
        error: 'Nonce expired',
      };
    }

    return {
      valid: true,
      user,
    };
  }

  async invalidateNonce(walletAddress) {
    const normalizedAddress = walletAddress.toLowerCase();

    const user = await User.findOne({ walletAddress: normalizedAddress });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate new nonce to invalidate old one
    user.nonce = crypto.randomBytes(AUTH_CONSTANTS.NONCE_BYTES).toString('hex');
    user.nonceExpiresAt = new Date(Date.now() + AUTH_CONSTANTS.NONCE_EXPIRY_MS);

    await user.save();
  }

  /**
   * Get existing nonce for wallet address
   *
   * @param {string} walletAddress - Ethereum wallet address
   * @returns {Promise<{nonce: string, expiresAt: Date}|null>} Nonce data or null
   */
  async getNonce(walletAddress) {
    // Validate wallet address
    if (!walletAddress) {
      const error = new Error('Wallet address is required');
      error.statusCode = 400;
      throw error;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      const error = new Error('Invalid Ethereum address format');
      error.statusCode = 400;
      throw error;
    }

    const normalizedAddress = walletAddress.toLowerCase();

    const user = await User.findOne({ walletAddress: normalizedAddress });

    if (!user || !user.nonce || !user.nonceExpiresAt) {
      return null;
    }

    // Check if nonce is expired
    if (new Date() > user.nonceExpiresAt) {
      return null;
    }

    return {
      nonce: user.nonce,
      expiresAt: user.nonceExpiresAt,
    };
  }

}

export default NonceService;
