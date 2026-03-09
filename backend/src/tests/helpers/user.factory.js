/**
 * User factory for generating test users
 * Provides utilities for creating test user data
 */

import crypto from 'crypto';

/**
 * Generate a random Ethereum address
 */
export function generateWalletAddress() {
  const randomBytes = crypto.randomBytes(20);
  return '0x' + randomBytes.toString('hex');
}

/**
 * Generate a cryptographic nonce
 */
export function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create test user data
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} User data object
 */
export function createUserData(overrides = {}) {
  const walletAddress = generateWalletAddress();
  const nonce = generateNonce();
  const nonceExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

  return {
    walletAddress: walletAddress.toLowerCase(),
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    avatarUrl: 'https://example.com/avatar.png',
    role: 'user',
    nonce,
    nonceExpiresAt,
    isActive: true,
    ...overrides
  };
}

/**
 * Create multiple test users
 * @param {number} count - Number of users to create
 * @param {Object} overrides - Optional field overrides
 * @returns {Array} Array of user data objects
 */
export function createMultipleUsers(count, overrides = {}) {
  return Array.from({ length: count }, () => createUserData(overrides));
}

/**
 * Create test user with specific role
 * @param {string} role - User role (user, organizer, verifier, admin)
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} User data object
 */
export function createUserWithRole(role, overrides = {}) {
  return createUserData({ role, ...overrides });
}

/**
 * Create admin user
 */
export function createAdminUser(overrides = {}) {
  return createUserWithRole('admin', overrides);
}

/**
 * Create organizer user
 */
export function createOrganizerUser(overrides = {}) {
  return createUserWithRole('organizer', overrides);
}

/**
 * Create verifier user
 */
export function createVerifierUser(overrides = {}) {
  return createUserWithRole('verifier', overrides);
}

/**
 * Create regular user
 */
export function createRegularUser(overrides = {}) {
  return createUserWithRole('user', overrides);
}
