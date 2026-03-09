/**
 * Mock Redis client for testing
 * Provides in-memory Redis-like functionality for tests
 */

class MockRedisClient {
  constructor() {
    this.store = new Map();
    this.expirations = new Map();
  }

  /**
   * Set a key-value pair
   */
  async set(key, value, ...args) {
    this.store.set(key, value);

    // Handle EX (expiration in seconds)
    if (args.length >= 2 && args[0] === 'EX') {
      const seconds = args[1];
      const expiresAt = Date.now() + (seconds * 1000);
      this.expirations.set(key, expiresAt);

      // Auto-delete after expiration
      setTimeout(() => {
        this.del(key);
      }, seconds * 1000);
    }

    return 'OK';
  }

  /**
   * Get a value by key
   */
  async get(key) {
    // Check if key has expired
    if (this.expirations.has(key)) {
      const expiresAt = this.expirations.get(key);
      if (Date.now() > expiresAt) {
        this.del(key);
        return null;
      }
    }

    return this.store.get(key) || null;
  }

  /**
   * Delete a key
   */
  async del(key) {
    this.store.delete(key);
    this.expirations.delete(key);
    return 1;
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    return this.store.has(key) ? 1 : 0;
  }

  /**
   * Set expiration on a key
   */
  async expire(key, seconds) {
    if (!this.store.has(key)) {
      return 0;
    }

    const expiresAt = Date.now() + (seconds * 1000);
    this.expirations.set(key, expiresAt);

    setTimeout(() => {
      this.del(key);
    }, seconds * 1000);

    return 1;
  }

  /**
   * Get time to live for a key
   */
  async ttl(key) {
    if (!this.store.has(key)) {
      return -2;
    }

    if (!this.expirations.has(key)) {
      return -1;
    }

    const expiresAt = this.expirations.get(key);
    const ttl = Math.floor((expiresAt - Date.now()) / 1000);

    return ttl > 0 ? ttl : -2;
  }

  /**
   * Increment a value
   */
  async incr(key) {
    const current = parseInt(this.store.get(key) || '0');
    const newValue = current + 1;
    this.store.set(key, newValue.toString());
    return newValue;
  }

  /**
   * Decrement a value
   */
  async decr(key) {
    const current = parseInt(this.store.get(key) || '0');
    const newValue = current - 1;
    this.store.set(key, newValue.toString());
    return newValue;
  }

  /**
   * Clear all data
   */
  async flushall() {
    this.store.clear();
    this.expirations.clear();
    return 'OK';
  }

  /**
   * Clear database
   */
  async flushdb() {
    return this.flushall();
  }

  /**
   * Ping the server
   */
  async ping() {
    return 'PONG';
  }

  /**
   * Quit the connection
   */
  async quit() {
    return 'OK';
  }

  /**
   * Disconnect
   */
  async disconnect() {
    return 'OK';
  }
}

/**
 * Create a mock Redis client
 */
export function createMockRedisClient() {
  return new MockRedisClient();
}

export default MockRedisClient;
