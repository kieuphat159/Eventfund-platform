/**
 * Request/Response helpers for testing
 * Provides mock request and response objects for unit tests
 */

/**
 * Create mock Express request object
 * @param {Object} options - Request options
 * @returns {Object} Mock request object
 */
export function createMockRequest(options = {}) {
  return {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    headers: options.headers || {},
    user: options.user || null,
    method: options.method || 'GET',
    url: options.url || '/',
    ip: options.ip || '127.0.0.1',
    ...options
  };
}

/**
 * Create mock Express response object
 * @returns {Object} Mock response object with spy functions
 */
export function createMockResponse() {
  const res = {
    statusCode: 200,
    data: null,
    headers: {},

    status: function(code) {
      this.statusCode = code;
      return this;
    },

    json: function(data) {
      this.data = data;
      return this;
    },

    send: function(data) {
      this.data = data;
      return this;
    },

    set: function(field, value) {
      if (typeof field === 'object') {
        Object.assign(this.headers, field);
      } else {
        this.headers[field] = value;
      }
      return this;
    },

    header: function(field, value) {
      return this.set(field, value);
    },

    get: function(field) {
      return this.headers[field];
    },

    cookie: function(name, value, options) {
      this.cookies = this.cookies || {};
      this.cookies[name] = { value, options };
      return this;
    },

    clearCookie: function(name) {
      if (this.cookies) {
        delete this.cookies[name];
      }
      return this;
    },

    redirect: function(url) {
      this.redirectUrl = url;
      return this;
    }
  };

  return res;
}

/**
 * Create mock Express next function
 * @returns {Function} Mock next function
 */
export function createMockNext() {
  return jest.fn();
}

/**
 * Create authenticated mock request
 * @param {Object} user - User object to attach to request
 * @param {Object} options - Additional request options
 * @returns {Object} Mock request with user attached
 */
export function createAuthenticatedRequest(user, options = {}) {
  return createMockRequest({
    user,
    headers: {
      authorization: `Bearer ${user.token || 'mock-token'}`,
      ...options.headers
    },
    ...options
  });
}

/**
 * Extract response data from mock response
 * @param {Object} res - Mock response object
 * @returns {Object} Response data
 */
export function getResponseData(res) {
  return {
    statusCode: res.statusCode,
    data: res.data,
    headers: res.headers
  };
}
