import { SiweMessage } from 'siwe';
import { AUTH_CONSTANTS } from '../../constants/auth.constants.js';
import config from '../../config/env.js';
import { toChecksumAddress } from '../../utils/address.js';

/**
 * SIWEService - Sign-In with Ethereum service
 *
 * Responsibilities:
 * - Create SIWE-formatted messages for wallet signing
 * - Parse and validate SIWE message structure
 * - Verify SIWE message signatures cryptographically
 */
class SIWEService {
  /**
   * Create a SIWE message for wallet signing
   *
   * @param {string} walletAddress - Ethereum wallet address
   * @param {string} nonce - Cryptographic nonce
   * @param {string} domain - Domain requesting sign-in
   * @param {string} uri - URI of the application
   * @param {number} chainId - Optional chain ID (defaults to config)
   * @returns {string} SIWE-formatted message string
   *
   * Preconditions:
   * - walletAddress is valid Ethereum address
   * - nonce is non-empty string
   * - domain and uri are non-empty strings
   *
   * Postconditions:
   * - Returns SIWE-formatted message string
   * - Message includes all required SIWE fields
   * - Message is ready for wallet signing
   */
  createSIWEMessage(walletAddress, nonce, domain, uri, chainId) {
    // Convert to EIP-55 checksum format for SIWE compliance
    const checksummedAddress = toChecksumAddress(walletAddress);

    const message = new SiweMessage({
      domain: domain || config.siwe.domain,
      address: checksummedAddress,
      statement: AUTH_CONSTANTS.SIWE_STATEMENT,
      uri: uri || config.siwe.uri,
      version: AUTH_CONSTANTS.SIWE_VERSION,
      chainId: chainId || config.siwe.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + AUTH_CONSTANTS.NONCE_EXPIRY_MS).toISOString(),
    });

    return message.prepareMessage();
  }

  /**
   * Parse and validate SIWE message structure
   *
   * @param {string} message - SIWE message string
   * @returns {{valid: boolean, parsed?: SiweMessage, error?: string}} Parse result
   *
   * Preconditions:
   * - message is non-null string
   *
   * Postconditions:
   * - Returns validation result with parsed message if valid
   * - Returns error message if invalid
   * - No side effects
   */
  parseSIWEMessage(message) {
    try {
      const parsed = new SiweMessage(message);

      return {
        valid: true,
        parsed,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message || 'Invalid SIWE message format',
      };
    }
  }

  /**
   * Verify SIWE message signature cryptographically
   *
   * @param {string} message - SIWE message string
   * @param {string} signature - Signature from wallet
   * @returns {Promise<{valid: boolean, address?: string, error?: string}>} Verification result
   *
   * Preconditions:
   * - message is valid SIWE-formatted string
   * - signature is hex string (0x + 130 hex chars)
   *
   * Postconditions:
   * - Returns verification result with recovered address if valid
   * - Returns error message if invalid
   * - Signature is cryptographically verified
   */
  async verifySIWE(message, signature) {
    try {
      // Parse message
      const siweMessage = new SiweMessage(message);

      // Verify signature
      const fields = await siweMessage.verify({ signature });

      // Verification successful
      return {
        valid: true,
        address: fields.data.address,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message || 'Signature verification failed',
      };
    }
  }
}

export default SIWEService;
