import Redis from 'ioredis';
import config from './env.js';
import logger from './logger.js';

/**
 * Redis Cloud Client Configuration
 *
 * Connects to Redis Cloud using ioredis with TLS support
 * Implements connection pooling, error handling, and reconnection logic
 */

let redisClient = null;
let isConnected = false;

/**
 * Create and configure Redis client
 * @returns {Redis} Redis client instance
 */
function createRedisClient() {
  const redisConfig = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,

    // TLS configuration for Redis Cloud
    tls: config.redis.tls ? {
      rejectUnauthorized: false, // For Redis Cloud with self-signed certs
    } : undefined,

    // Connection options
    connectTimeout: 10000, // 10 seconds
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,

    // Retry strategy
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis connection retry attempt ${times}, delay: ${delay}ms`);
      return delay;
    },

    // Reconnect on error
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Reconnect when Redis is in readonly mode
        return true;
      }
      return false;
    },
  };

  const client = new Redis(redisConfig);

  // Event handlers
  client.on('connect', () => {
    logger.info('Redis client connecting...');
  });

  client.on('ready', () => {
    isConnected = true;
    logger.info('Redis client connected and ready', {
      host: config.redis.host,
      port: config.redis.port,
    });
  });

  client.on('error', (err) => {
    isConnected = false;
    logger.error('Redis client error', {
      error: err.message,
      code: err.code,
    });
  });

  client.on('close', () => {
    isConnected = false;
    logger.warn('Redis client connection closed');
  });

  client.on('reconnecting', () => {
    logger.info('Redis client reconnecting...');
  });

  return client;
}

/**
 * Get Redis client instance (singleton)
 * @returns {Redis} Redis client
 */
export function getRedisClient() {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

/**
 * Check if Redis is connected
 * @returns {boolean} Connection status
 */
export function isRedisConnected() {
  return isConnected;
}

/**
 * Ping Redis to check connection
 * @returns {Promise<boolean>} True if ping successful
 */
export async function pingRedis() {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis ping failed', { error: error.message });
    return false;
  }
}

/**
 * Gracefully disconnect Redis client
 * @returns {Promise<void>}
 */
export async function disconnectRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis client disconnected gracefully');
      redisClient = null;
      isConnected = false;
    } catch (error) {
      logger.error('Error disconnecting Redis client', { error: error.message });
      // Force disconnect if graceful quit fails
      redisClient.disconnect();
      redisClient = null;
      isConnected = false;
    }
  }
}

/**
 * Initialize Redis connection and verify
 * @returns {Promise<void>}
 */
export async function initializeRedis() {
  try {
    const client = getRedisClient();

    // Test connection with ping
    const pingResult = await pingRedis();

    if (!pingResult) {
      throw new Error('Redis ping failed');
    }

    logger.info('Redis initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Redis', { error: error.message });
    throw error;
  }
}

export default {
  getRedisClient,
  isRedisConnected,
  pingRedis,
  disconnectRedis,
  initializeRedis,
};
