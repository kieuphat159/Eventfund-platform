/**
 * E2E Integration Tests for Users Routes
 * Focus: Happy Path & Business Logic Errors
 *
 * Test Strategy:
 * - Happy Path: Verify complete user profile lifecycle with valid data
 * - Business Logic Errors: Test domain-specific error conditions
 * - User Management: Test user profile CRUD operations and business rules
 *
 * Requirements: 6.3
 */

import request from 'supertest';
import app from '../../../app.js';
import User from '../../../models/User.model.js';
import JWTService from '../../../services/auth/jwt.service.js';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../../helpers/db.helper.js';

const jwtService = new JWTService();

describe('Users Routes - E2E Integration Tests', () => {
  let userToken;
  let anotherUserToken;
  let testUser;
  let anotherUser;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create test users
    testUser = await User.create({
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      role: 'user',
      nonce: 'test-nonce-user',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    anotherUser = await User.create({
      walletAddress: '0x123d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
      role: 'user',
      username: 'existing_user',
      email: 'existing@example.com',
      nonce: 'test-nonce-another',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    // Generate JWT tokens
    userToken = jwtService.generateToken(testUser.walletAddress, testUser.role);
    anotherUserToken = jwtService.generateToken(anotherUser.walletAddress, anotherUser.role);
  });

  afterEach(async () => {
    await clearTestDB();
  });

  // ============================================================================
  // HAPPY PATH TESTS - Complete User Profile Lifecycle
  // ============================================================================

  describe('Happy Path - User Profile Management', () => {
    test('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.walletAddress).toBe(testUser.walletAddress.toLowerCase());
      expect(response.body.data.role).toBe('user');
    });

    test('should update username successfully', async () => {
      const updateData = {
        username: 'john_doe123'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('john_doe123');
      expect(response.body.data.walletAddress).toBe(testUser.walletAddress.toLowerCase());

      // Verify database update
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.username).toBe('john_doe123');
    });

    test('should update email successfully', async () => {
      const updateData = {
        email: 'newemail@example.com'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('newemail@example.com');

      // Verify database update
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.email).toBe('newemail@example.com');
    });

    test('should update multiple fields simultaneously', async () => {
      const updateData = {
        username: 'john_doe',
        email: 'john@example.com'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('john_doe');
      expect(response.body.data.email).toBe('john@example.com');

      // Verify database update
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.username).toBe('john_doe');
      expect(updatedUser.email).toBe('john@example.com');
    });

    test('should get user by wallet address', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.walletAddress}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.walletAddress).toBe(testUser.walletAddress.toLowerCase());
      expect(response.body.data.role).toBe('user');
    });

    test('should handle case-insensitive wallet address lookup', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.walletAddress.toUpperCase()}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.walletAddress).toBe(testUser.walletAddress.toLowerCase());
    });

    test('should strip unknown fields from update', async () => {
      const updateData = {
        username: 'john_doe',
        email: 'john@example.com',
        avatarUrl: 'https://malicious-site.com/xss.jpg', // Should be stripped - security risk!
        unknownField: 'should be stripped',
        anotherUnknown: 123,
        role: 'admin' // Should be stripped - privilege escalation attempt!
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('john_doe');
      expect(response.body.data.email).toBe('john@example.com');

      // Security: avatarUrl must NOT be updated via JSON payload
      expect(response.body.data).not.toHaveProperty('unknownField');
      expect(response.body.data).not.toHaveProperty('anotherUnknown');

      // Verify database - avatarUrl should remain unchanged
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.avatarUrl).not.toBe('https://malicious-site.com/xss.jpg');
      expect(updatedUser.role).toBe('user'); // Role should not change
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Authorization
  // ============================================================================

  describe('Business Logic Errors - Authorization', () => {
    test('should reject profile access without authentication', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Authentication required');
    });

    test('should reject profile update without authentication', async () => {
      const updateData = {
        username: 'john_doe'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .send(updateData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Authentication required');
    });

    test('should reject profile update with invalid token', async () => {
      const updateData = {
        username: 'john_doe'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .send(updateData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Duplicate Data
  // ============================================================================

  describe('Business Logic Errors - Duplicate Data', () => {
    test('should reject duplicate username', async () => {
      const updateData = {
        username: 'existing_user' // Already used by anotherUser
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Username already exists');
    });

    test('should reject duplicate email', async () => {
      const updateData = {
        email: 'existing@example.com' // Already used by anotherUser
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Email already exists');
    });

    test('should allow updating to own username', async () => {
      // First set a username
      await User.findByIdAndUpdate(testUser._id, { username: 'my_username' });

      const updateData = {
        username: 'my_username', // Same as current
        email: 'newemail@example.com'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('my_username');
    });

    test('should allow updating to own email', async () => {
      // First set an email
      await User.findByIdAndUpdate(testUser._id, { email: 'myemail@example.com' });

      const updateData = {
        email: 'myemail@example.com', // Same as current
        username: 'new_username'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('myemail@example.com');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Not Found
  // ============================================================================

  describe('Business Logic Errors - Not Found', () => {
    test('should return 404 for non-existent wallet address', async () => {
      const response = await request(app)
        .get('/api/users/0x9999999999999999999999999999999999999999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('User not found');
    });

    test('should return 400 for invalid wallet address format', async () => {
      const response = await request(app)
        .get('/api/users/invalid-address')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      expect(response.body.error.details).toBeDefined();
      expect(Array.isArray(response.body.error.details)).toBe(true);
      const detail = response.body.error.details.find(d => d.field === 'walletAddress');
      expect(detail).toBeDefined();
      expect(detail.message).toContain('valid Ethereum address');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC - Validation Errors
  // ============================================================================

  describe('Business Logic - Validation Errors', () => {
    test('should reject empty request body', async () => {
      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Validation failed');
    });
    test('should reject invalid email format', async () => {
      const invalidData = {
        email: 'notanemail.com'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('email');

      expect(response.body.error.details).toBeDefined();
      expect(Array.isArray(response.body.error.details)).toBe(true);
      const detail = response.body.error.details.find(d => d.field === 'email');
      expect(detail).toBeDefined();
      expect(detail.message).toContain('email');
    });

    test('should reject username too short', async () => {
      const invalidData = {
        username: 'ab'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      expect(response.body.error.details).toBeDefined();
      expect(Array.isArray(response.body.error.details)).toBe(true);
      const detail = response.body.error.details.find(d => d.field === 'username');
      expect(detail).toBeDefined();
      expect(detail.message).toContain('3');
    });

    test('should reject username too long', async () => {
      const invalidData = {
        username: 'a'.repeat(51)
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      expect(response.body.error.details).toBeDefined();
      expect(Array.isArray(response.body.error.details)).toBe(true);
      const detail = response.body.error.details.find(d => d.field === 'username');
      expect(detail).toBeDefined();
      expect(detail.message).toContain('50');
    });

    test('should reject username with invalid characters', async () => {
      const invalidData = {
        username: 'john doe' // Contains space
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      expect(response.body.error.details).toBeDefined();
      expect(Array.isArray(response.body.error.details)).toBe(true);
      const detail = response.body.error.details.find(d => d.field === 'username');
      expect(detail).toBeDefined();
      expect(detail.message).toContain('alphanumeric');
    });

    test('should reject invalid avatarUrl format', async () => {
      // Note: avatarUrl is now stripped by stripUnknown: true, not rejected
      // This test verifies that sending ONLY avatarUrl (no valid fields) triggers validation error
      const invalidData = {
        avatarUrl: 'not-a-url'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      // Should fail because no valid fields provided (avatarUrl is stripped)
      expect(response.body.error.message).toBe('Validation failed');
    });

    test('should reject empty string values', async () => {
      const invalidData = {
        username: '',
        email: ''
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });

    test('should return all validation errors in single response', async () => {
      // Note: avatarUrl is stripped, so we only test username and email validation
      const invalidData = {
        username: 'ab', // Too short
        email: 'not-an-email' // Invalid format
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toHaveLength(2); // username + email

      const fields = response.body.error.details.map(d => d.field);
      expect(fields).toContain('username');
      expect(fields).toContain('email');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC - Error Response Structure
  // ============================================================================

  describe('Business Logic - Error Response Structure', () => {
    test('should return consistent error structure for validation failures', async () => {
      // Note: avatarUrl is stripped, so we only test username and email validation
      const invalidData = {
        username: 'ab',
        email: 'invalid-email'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);

      // Verify complete error response structure
      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');

      const { error } = response.body;
      expect(error).toHaveProperty('code');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error).toHaveProperty('message');
      expect(error.message).toBe('Validation failed');
      expect(error).toHaveProperty('details');
      expect(Array.isArray(error.details)).toBe(true);
      expect(error.details).toHaveLength(2); // username + email errors

      // Verify each detail has required fields
      error.details.forEach(detail => {
        expect(detail).toHaveProperty('field');
        expect(detail).toHaveProperty('message');
        expect(detail).toHaveProperty('type');
        expect(typeof detail.field).toBe('string');
        expect(typeof detail.message).toBe('string');
        expect(typeof detail.type).toBe('string');
      });
    });

    test('should return consistent error structure for business logic errors', async () => {
      const duplicateData = {
        username: 'existing_user'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(duplicateData)
        .expect(409);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });

    test('should return consistent error structure for not found errors', async () => {
      const response = await request(app)
        .get('/api/users/0x9999999999999999999999999999999999999999')
        .expect(404);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });
  });
});
