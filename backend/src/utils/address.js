/**
 * Address Utilities
 *
 * Utilities for validating and normalizing Ethereum wallet addresses.
 * All addresses are stored in lowercase in the database for consistency.
 *
 * @module utils/address
 */

import { getAddress } from 'ethers';

/**
 * Validates if a string is a valid Ethereum address format
 *
 * Ethereum addresses are 42 characters: "0x" prefix + 40 hexadecimal characters
 *
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid Ethereum address format
 *
 * @example
 * isValidAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb") // true
 * isValidAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1") // true (40 hex chars)
 * isValidAddress("742d35Cc6634C0532925a3b844Bc9e7595f0bEb") // false (missing 0x)
 * isValidAddress("0x742d35Cc") // false (too short)
 * isValidAddress("0xGGGG35Cc6634C0532925a3b844Bc9e7595f0bEb") // false (invalid hex)
 */
export const isValidAddress = (address) => {
  if (typeof address !== 'string') {
    return false;
  }

  // Check if it matches Ethereum address pattern: 0x followed by 40 hex characters
  const ethereumAddressPattern = /^0x[a-fA-F0-9]{40}$/;
  return ethereumAddressPattern.test(address);
};

/**
 * Normalizes an Ethereum address to lowercase
 *
 * All addresses are stored in lowercase in the database for consistency
 * and to enable case-insensitive queries.
 *
 * @param {string} address - Address to normalize
 * @returns {string} Lowercase address
 * @throws {Error} If address is not valid
 *
 * @example
 * normalizeAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb")
 * // "0x742d35cc6634c0532925a3b844bc9e7595f0beb"
 */
export const normalizeAddress = (address) => {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  return address.toLowerCase();
};

/**
 * Validates and normalizes an Ethereum address
 *
 * Convenience function that combines validation and normalization.
 * Returns null if address is invalid instead of throwing.
 *
 * @param {string} address - Address to validate and normalize
 * @returns {string|null} Normalized address or null if invalid
 *
 * @example
 * validateAndNormalize("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb")
 * // "0x742d35cc6634c0532925a3b844bc9e7595f0beb"
 *
 * validateAndNormalize("invalid") // null
 */
export const validateAndNormalize = (address) => {
  if (!isValidAddress(address)) {
    return null;
  }

  return normalizeAddress(address);
};

/**
 * Compares two Ethereum addresses for equality (case-insensitive)
 *
 * @param {string} address1 - First address
 * @param {string} address2 - Second address
 * @returns {boolean} True if addresses are equal (case-insensitive)
 *
 * @example
 * areAddressesEqual(
 *   "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
 *   "0x742d35cc6634c0532925a3b844bc9e7595f0beb"
 * ) // true
 */
export const areAddressesEqual = (address1, address2) => {
  if (!isValidAddress(address1) || !isValidAddress(address2)) {
    return false;
  }

  return address1.toLowerCase() === address2.toLowerCase();
};

/**
 * Formats an address for display (shortens to first 6 and last 4 characters)
 *
 * @param {string} address - Address to format
 * @returns {string} Formatted address (e.g., "0x742d...0bEb")
 *
 * @example
 * formatAddressForDisplay("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb")
 * // "0x742d...0bEb"
 */
export const formatAddressForDisplay = (address) => {
  if (!isValidAddress(address)) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Converts an address to EIP-55 checksum format
 *
 * @param {string} address - Address to convert
 * @returns {string} Checksummed address
 * @throws {Error} If address is not valid
 *
 * @example
 * toChecksumAddress("0x742d35cc6634c0532925a3b844bc9e7595f0beb0")
 * // "0x742D35CC6634c0532925A3b844BC9E7595F0BEb0"
 */
export const toChecksumAddress = (address) => {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  try {
    // Normalize to lowercase first, then apply checksum
    // This handles addresses with incorrect mixed-case
    return getAddress(address.toLowerCase());
  } catch (error) {
    throw new Error(`Failed to checksum address: ${error.message}`);
  }
};

/**
 * Checks if an address is the zero address (0x0000...0000)
 *
 * @param {string} address - Address to check
 * @returns {boolean} True if address is zero address
 *
 * @example
 * isZeroAddress("0x0000000000000000000000000000000000000000") // true
 * isZeroAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb") // false
 */
export const isZeroAddress = (address) => {
  if (!isValidAddress(address)) {
    return false;
  }

  const zeroAddress = '0x0000000000000000000000000000000000000000';
  return address.toLowerCase() === zeroAddress;
};

export default {
  isValidAddress,
  normalizeAddress,
  validateAndNormalize,
  areAddressesEqual,
  formatAddressForDisplay,
  toChecksumAddress,
  isZeroAddress,
};
