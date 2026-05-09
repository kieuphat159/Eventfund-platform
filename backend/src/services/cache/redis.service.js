import { getRedisClient, isRedisConnected } from '../../config/redis.js';
import config from '../../config/env.js';
import logger from '../../config/logger.js';

/**
 * Redis Cache Service
 *
 * Provides high-level caching operations with:
 * - Automatic JSON serialization/deserialization
 * - TTL management
 * - Error handling with fallback
 * - Cache invalidation patterns
 */

class RedisCacheService {
  constructor() {
    this.client = null;
    this.ttls = config.redis.ttl;
  }

  /**
   * Get Redis client (lazy initialization)
   * @returns {Redis|null} Redis client or null if not connected
   */
  getClient() {
    if (!this.client) {
      this.client = getRedisClient();
    }
    return this.client;
  }

  /**
   * Check if cache is available
   * @returns {boolean} True if Redis is connected
   */
  isAvailable() {
    return isRedisConnected();
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null
   */
  async get(key) {
    if (!this.isAvailable()) {
      logger.debug('Redis not available, skipping cache get', { key });
      return null;
    }

    try {
      const client = this.getClient();
      const value = await client.get(key);

      if (!value) {
        logger.debug('Cache miss', { key });
        return null;
      }

      logger.debug('Cache hit', { key });
      return JSON.parse(value);
    } catch (error) {
      logger.error('Redis get error', {
        key,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON stringified)
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} True if successful
   */
  async set(key, value, ttl = null) {
    if (!this.isAvailable()) {
      logger.debug('Redis not available, skipping cache set', { key });
      return false;
    }

    try {
      const client = this.getClient();
      const serialized = JSON.stringify(value);

      if (ttl) {
        await client.set(key, serialized, 'EX', ttl);
      } else {
        await client.set(key, serialized);
      }

      logger.debug('Cache set', { key, ttl });
      return true;
    } catch (error) {
      logger.error('Redis set error', {
        key,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if successful
   */
  async del(key) {
    if (!this.isAvailable()) {
      logger.debug('Redis not available, skipping cache delete', { key });
      return false;
    }

    try {
      const client = this.getClient();
      await client.del(key);
      logger.debug('Cache deleted', { key });
      return true;
    } catch (error) {
      logger.error('Redis delete error', {
        key,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * @param {string} pattern - Key pattern (e.g., "user:*")
   * @returns {Promise<number>} Number of keys deleted
   */
  async delPattern(pattern) {
    if (!this.isAvailable()) {
      logger.debug('Redis not available, skipping pattern delete', { pattern });
      return 0;
    }

    try {
      const client = this.getClient();
      const keys = await client.keys(pattern);

      if (keys.length === 0) {
        logger.debug('No keys found for pattern', { pattern });
        return 0;
      }

      await client.del(...keys);
      logger.debug('Cache pattern deleted', { pattern, count: keys.length });
      return keys.length;
    } catch (error) {
      logger.error('Redis pattern delete error', {
        pattern,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if key exists
   */
  async exists(key) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const client = this.getClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error', {
        key,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Set expiration time for a key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} True if successful
   */
  async expire(key, ttl) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const client = this.getClient();
      await client.expire(key, ttl);
      logger.debug('Cache expiration set', { key, ttl });
      return true;
    } catch (error) {
      logger.error('Redis expire error', {
        key,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds, -1 if no expiration, -2 if key doesn't exist
   */
  async ttl(key) {
    if (!this.isAvailable()) {
      return -2;
    }

    try {
      const client = this.getClient();
      return await client.ttl(key);
    } catch (error) {
      logger.error('Redis TTL error', {
        key,
        error: error.message,
      });
      return -2;
    }
  }

  // ==================== Domain-specific cache methods ====================

  /**
   * Cache user profile
   * @param {string} walletAddress - User wallet address (lowercase)
   * @param {Object} userData - User data to cache
   * @returns {Promise<boolean>} True if successful
   */
  async cacheUser(walletAddress, userData) {
    const key = `user:${walletAddress.toLowerCase()}`;
    return await this.set(key, userData, this.ttls.user);
  }

  /**
   * Get cached user profile
   * @param {string} walletAddress - User wallet address
   * @returns {Promise<Object|null>} User data or null
   */
  async getUser(walletAddress) {
    const key = `user:${walletAddress.toLowerCase()}`;
    return await this.get(key);
  }

  /**
   * Invalidate user cache
   * @param {string} walletAddress - User wallet address
   * @returns {Promise<boolean>} True if successful
   */
  async invalidateUser(walletAddress) {
    const key = `user:${walletAddress.toLowerCase()}`;
    return await this.del(key);
  }

  /**
   * Cache event details
   * @param {string} eventId - Event ID
   * @param {Object} eventData - Event data to cache
   * @returns {Promise<boolean>} True if successful
   */
  async cacheEvent(eventId, eventData) {
    const key = `event:${eventId}`;
    return await this.set(key, eventData, this.ttls.event);
  }

  /**
   * Get cached event details
   * @param {string} eventId - Event ID
   * @returns {Promise<Object|null>} Event data or null
   */
  async getEvent(eventId) {
    const key = `event:${eventId}`;
    return await this.get(key);
  }

  /**
   * Invalidate event cache
   * @param {string} eventId - Event ID
   * @returns {Promise<boolean>} True if successful
   */
  async invalidateEvent(eventId) {
    const key = `event:${eventId}`;
    // Also invalidate related caches
    await this.del(`event:${eventId}:stats`);
    return await this.del(key);
  }

  /**
   * Cache event statistics
   * @param {string} eventId - Event ID
   * @param {Object} stats - Event statistics
   * @returns {Promise<boolean>} True if successful
   */
  async cacheEventStats(eventId, stats) {
    const key = `event:${eventId}:stats`;
    return await this.set(key, stats, this.ttls.eventStats);
  }

  /**
   * Get cached event statistics
   * @param {string} eventId - Event ID
   * @returns {Promise<Object|null>} Event statistics or null
   */
  async getEventStats(eventId) {
    const key = `event:${eventId}:stats`;
    return await this.get(key);
  }

  /**
   * Cache blockchain configuration
   * @param {Object} config - Blockchain config
   * @returns {Promise<boolean>} True if successful
   */
  async cacheBlockchainConfig(config) {
    const key = 'blockchain:config';
    return await this.set(key, config, this.ttls.blockchainConfig);
  }

  /**
   * Get cached blockchain configuration
   * @returns {Promise<Object|null>} Blockchain config or null
   */
  async getBlockchainConfig() {
    const key = 'blockchain:config';
    return await this.get(key);
  }
}

// Export singleton instance
export default new RedisCacheService();
