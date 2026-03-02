/**
 * Authentication Constants
 *
 * Non-sensitive configuration values for authentication system
 */

export const AUTH_CONSTANTS = {
  // Nonce configuration
  NONCE_BYTES: 32, // 32 bytes = 64 hex characters
  NONCE_EXPIRY_MINUTES: 5, // Nonce valid for 5 minutes
  NONCE_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes in milliseconds

  // SIWE configuration
  SIWE_VERSION: '1',
  SIWE_STATEMENT: 'Sign in to EventFund Platform',

  // Default values (can be overridden by environment variables)
  DEFAULT_JWT_EXPIRY: '7d',
  DEFAULT_SIWE_DOMAIN: 'localhost:4000',
  DEFAULT_SIWE_URI: 'http://localhost:4000',
};

export default AUTH_CONSTANTS;
