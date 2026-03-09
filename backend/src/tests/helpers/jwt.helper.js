/**
 * JWT helper for generating test tokens
 * Provides utilities for creating JWT tokens for authenticated tests
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for test user
 * @param {Object} payload - Token payload (walletAddress, role)
 * @param {Object} options - Optional JWT options
 * @returns {string} JWT token
 */
export function generateTestToken(payload, options = {}) {
  const defaultPayload = {
    walletAddress: payload.walletAddress,
    role: payload.role || 'user'
  };

  const defaultOptions = {
    expiresIn: JWT_EXPIRES_IN,
    ...options
  };

  return jwt.sign(defaultPayload, JWT_SECRET, defaultOptions);
}

/**
 * Generate expired JWT token for testing
 * @param {Object} payload - Token payload
 * @returns {string} Expired JWT token
 */
export function generateExpiredToken(payload) {
  return generateTestToken(payload, { expiresIn: '-1h' });
}

/**
 * Generate token for admin user
 * @param {string} walletAddress - Wallet address
 * @returns {string} JWT token
 */
export function generateAdminToken(walletAddress) {
  return generateTestToken({ walletAddress, role: 'admin' });
}

/**
 * Generate token for organizer user
 * @param {string} walletAddress - Wallet address
 * @returns {string} JWT token
 */
export function generateOrganizerToken(walletAddress) {
  return generateTestToken({ walletAddress, role: 'organizer' });
}

/**
 * Generate token for verifier user
 * @param {string} walletAddress - Wallet address
 * @returns {string} JWT token
 */
export function generateVerifierToken(walletAddress) {
  return generateTestToken({ walletAddress, role: 'verifier' });
}

/**
 * Generate token for regular user
 * @param {string} walletAddress - Wallet address
 * @returns {string} JWT token
 */
export function generateUserToken(walletAddress) {
  return generateTestToken({ walletAddress, role: 'user' });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
export function verifyTestToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Decode JWT token without verification
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded token payload
 */
export function decodeTestToken(token) {
  return jwt.decode(token);
}
