/**
 * Jest setup file - runs before all tests
 * Configures test environment and global settings
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '7d';

// Cloudinary test credentials
process.env.CLOUDINARY_NAME = 'test-cloud';
process.env.CLOUDINARY_KEY = 'test-key';
process.env.CLOUDINARY_SECRET = 'test-secret';

// Note: jest.setTimeout is called in individual test files as needed
// since jest is not available in setup files with ES modules

// Suppress console output during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
