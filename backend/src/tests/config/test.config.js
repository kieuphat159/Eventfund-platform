/**
 * Test configuration
 * Provides configuration for test environment
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

export const testConfig = {
  // Server configuration
  port: process.env.PORT || 5001,
  host: process.env.HOST || 'localhost',

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  // MongoDB configuration (overridden by mongodb-memory-server)
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/eventfund-test'
  },

  // Redis configuration (mocked in tests)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || ''
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5
  },

  // SIWE configuration
  siwe: {
    domain: process.env.SIWE_DOMAIN || 'localhost',
    uri: process.env.SIWE_URI || 'http://localhost:5001',
    nonceExpirationMinutes: parseInt(process.env.NONCE_EXPIRATION_MINUTES) || 5
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'error',
    fileEnabled: process.env.LOG_FILE_ENABLED === 'true'
  },

  // Pagination configuration
  pagination: {
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE) || 20,
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE) || 100
  }
};

export default testConfig;
