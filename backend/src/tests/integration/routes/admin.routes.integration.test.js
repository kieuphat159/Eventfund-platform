/**
 * E2E Integration Tests for Admin Routes
 * Focus: Happy Path & Business Logic Errors
 *
 * Test Strategy:
 * - Happy Path: Verify successful operations with valid data
 * - Business Logic Errors: Test domain-specific error conditions
 * - Authentication & Authorization: Verify access control
 */

import request from 'supertest';
import app from '../../../app.js';
import User from '../../../models/User.model.js';
import Event from '../../../models/Event.model.js';
import JWTService from '../../../services/auth/jwt.service.js';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../../helpers/db.helper.js';

const jwtService = new JWTService();

describe('Admin Routes - E2E Integration Tests', () => {
  let adminToken;
  let userToken;
  let organizerToken;
  let testAdmin;
  let testUser;
  let testOrganizer;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create test users
    testAdmin = await User.create({
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      role: 'admin',
      nonce: 'test-nonce-admin',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    testUser = await User.create({
      walletAddress: '0x1234567890123456789012345678901234567890',
      role: 'user',
      nonce: 'test-nonce-user',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    testOrganizer = await User.create({
      walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      role: 'organizer',
      nonce: 'test-nonce-organizer',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    // Generate JWT tokens
    adminToken = jwtService.generateToken(testAdmin.walletAddress, testAdmin.role);
    userToken = jwtService.generateToken(testUser.walletAddress, testUser.role);
    organizerToken = jwtService.generateToken(testOrganizer.walletAddress, testOrganizer.role);
  });

  afterEach(async () => {
    await clearTestDB();
  });

  describe('GET /api/admin/stats - Platform Statistics', () => {
    describe('Happy Path', () => {
      it('should return platform statistics for admin user', async () => {
        // Create some test data
        await Event.create({
          title: 'Test Event',
          description: 'Test Description',
          organizer: testOrganizer.walletAddress,
          status: 'funding',
          fundingGoal: '1000000000000000000',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          totalTickets: 100
        });

        const response = await request(app)
          .get('/api/admin/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('users');
        expect(response.body.data).toHaveProperty('events');
        expect(response.body.data).toHaveProperty('tickets');
        expect(response.body.data).toHaveProperty('listings');
        expect(response.body.data).toHaveProperty('revenue');

        // Verify user stats
        expect(response.body.data.users.total).toBeGreaterThanOrEqual(3);
        expect(response.body.data.users.organizers).toBeGreaterThanOrEqual(1);
        expect(response.body.data.users.admins).toBeGreaterThanOrEqual(1);

        // Verify event stats
        expect(response.body.data.events.total).toBeGreaterThanOrEqual(1);
        expect(response.body.data.events.funding).toBeGreaterThanOrEqual(1);

        // Verify specific values
        expect(response.body.data.users.total).toBe(3);
        expect(response.body.data.users.organizers).toBe(1);
        expect(response.body.data.users.admins).toBe(1);
        expect(response.body.data.events.total).toBe(1);
        expect(response.body.data.events.funding).toBe(1);

        // Verify revenue structure (total và funding là BigInt serialized as string)
        expect(typeof response.body.data.revenue.total).toBe('string');
        expect(typeof response.body.data.revenue.funding).toBe('string');
      });
    });

    describe('Authentication & Authorization', () => {
      it('should return 401 for unauthenticated requests', async () => {
        const response = await request(app)
          .get('/api/admin/stats');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should return 403 for non-admin users', async () => {
        const response = await request(app)
          .get('/api/admin/stats')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('GET /api/admin/users - List Users', () => {
    describe('Happy Path', () => {
      it('should return paginated list of all users', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('docs');
        expect(response.body.data).toHaveProperty('totalDocs');
        expect(response.body.data).toHaveProperty('page');
        expect(response.body.data).toHaveProperty('limit');
        expect(Array.isArray(response.body.data.docs)).toBe(true);
        expect(response.body.data.docs.length).toBeGreaterThanOrEqual(3);
      });

      it('should filter users by role', async () => {
        const response = await request(app)
          .get('/api/admin/users?role=organizer')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        // Bắt buộc phải có data để tránh pass giả với mảng rỗng
        expect(response.body.data.docs.length).toBeGreaterThan(0);
        expect(response.body.data.docs.every(user => user.role === 'organizer')).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/admin/users?page=1&limit=2')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.limit).toBe(2);
        expect(response.body.data.page).toBe(1);
        // Kiểm tra số lượng phần tử thực tế trong mảng docs
        expect(response.body.data.docs.length).toBe(2);
      });

      it('should support sorting', async () => {
        const response = await request(app)
          .get('/api/admin/users?sort=walletAddress')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        // Kiểm tra thứ tự sắp xếp thực tế
        expect(response.body.data.docs.length).toBeGreaterThan(1);

        // Kiểm tra toàn bộ mảng được sắp xếp đúng
        const walletAddresses = response.body.data.docs.map(u => u.walletAddress);
        const sortedAddresses = [...walletAddresses].sort();
        expect(walletAddresses).toEqual(sortedAddresses);
      });

      it('should return empty array when filtering by role with no matches', async () => {
        const response = await request(app)
          .get('/api/admin/users?role=verifier')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.docs).toEqual([]);
        expect(response.body.data.totalDocs).toBe(0);
      });

      it('should handle last page with fewer items than limit', async () => {
        const response = await request(app)
          .get('/api/admin/users?page=2&limit=2')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.page).toBe(2);
        expect(response.body.data.docs.length).toBeLessThanOrEqual(2);
        expect(response.body.data.docs.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Authentication & Authorization', () => {
      it('should return 401 for unauthenticated requests', async () => {
        const response = await request(app)
          .get('/api/admin/users');

        expect(response.status).toBe(401);
      });

      it('should return 403 for non-admin users', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${organizerToken}`);

        expect(response.status).toBe(403);
      });
    });
  });

  describe('PATCH /api/admin/users/:walletAddress/role - Update User Role', () => {
    describe('Happy Path', () => {
      it('should successfully update user role from user to organizer', async () => {
        const response = await request(app)
          .patch(`/api/admin/users/${testUser.walletAddress}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'organizer' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.role).toBe('organizer');
        expect(response.body.data.walletAddress).toBe(testUser.walletAddress.toLowerCase());

        // Verify in database
        const updatedUser = await User.findOne({ walletAddress: testUser.walletAddress });
        expect(updatedUser.role).toBe('organizer');
      });

      it('should successfully update user role to verifier', async () => {
        const response = await request(app)
          .patch(`/api/admin/users/${testUser.walletAddress}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'verifier' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.role).toBe('verifier');
      });

      it('should successfully update user role to admin', async () => {
        const response = await request(app)
          .patch(`/api/admin/users/${testUser.walletAddress}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'admin' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.role).toBe('admin');
      });

      it('should handle updating to same role (idempotent)', async () => {
        const response = await request(app)
          .patch(`/api/admin/users/${testUser.walletAddress}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'user' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.role).toBe('user');
      });
    });

    describe('Business Logic Errors', () => {
      it('should return 404 when user does not exist', async () => {
        const nonExistentAddress = '0x9999999999999999999999999999999999999999';

        const response = await request(app)
          .patch(`/api/admin/users/${nonExistentAddress}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'organizer' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('User not found');
      });

      it('should return 400 for missing role field', async () => {
        const response = await request(app)
          .patch(`/api/admin/users/${testUser.walletAddress}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 for invalid role value', async () => {
        const response = await request(app)
          .patch(`/api/admin/users/${testUser.walletAddress}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'superadmin' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 for empty role string', async () => {
        const response = await request(app)
          .patch(`/api/admin/users/${testUser.walletAddress}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: '' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 for null role', async () => {
        const response = await request(app)
          .patch(`/api/admin/users/${testUser.walletAddress}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: null });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('Authentication & Authorization', () => {
      it('should return 401 for unauthenticated requests', async () => {
        const response = await request(app)
          .patch(`/api/admin/users/${testUser.walletAddress}/role`)
          .send({ role: 'organizer' });

        expect(response.status).toBe(401);
      });

      it('should return 403 for non-admin users', async () => {
        const response = await request(app)
          .patch(`/api/admin/users/${testUser.walletAddress}/role`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ role: 'organizer' });

        expect(response.status).toBe(403);
      });
    });
  });

  describe('DELETE /api/admin/users/:walletAddress - Delete User', () => {
    describe('Happy Path', () => {
      it('should successfully delete a user', async () => {
        const response = await request(app)
          .delete(`/api/admin/users/${testUser.walletAddress}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.walletAddress).toBe(testUser.walletAddress.toLowerCase());

        // Verify user is deleted from database
        const deletedUser = await User.findOne({ walletAddress: testUser.walletAddress });
        expect(deletedUser).toBeNull();
      });

      it('should handle deleting user with associated events', async () => {
        // Create event owned by testOrganizer
        await Event.create({
          title: 'Organizer Event',
          description: 'Test Description',
          organizer: testOrganizer.walletAddress,
          status: 'funding',
          fundingGoal: '1000000000000000000',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          totalTickets: 100
        });

        const response = await request(app)
          .delete(`/api/admin/users/${testOrganizer.walletAddress}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // Verify user is deleted
        const deletedUser = await User.findOne({ walletAddress: testOrganizer.walletAddress });
        expect(deletedUser).toBeNull();

        // Verify events still exist (business logic: events are not cascade deleted)
        const events = await Event.find({ organizer: testOrganizer.walletAddress });
        expect(events.length).toBeGreaterThan(0);
      });
    });

    describe('Business Logic Errors', () => {
      it('should return 404 when user does not exist', async () => {
        const nonExistentAddress = '0x9999999999999999999999999999999999999999';

        const response = await request(app)
          .delete(`/api/admin/users/${nonExistentAddress}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('User not found');
      });
    });

    describe('Authentication & Authorization', () => {
      it('should return 401 for unauthenticated requests', async () => {
        const response = await request(app)
          .delete(`/api/admin/users/${testUser.walletAddress}`);

        expect(response.status).toBe(401);
      });

      it('should return 403 for non-admin users', async () => {
        const response = await request(app)
          .delete(`/api/admin/users/${testUser.walletAddress}`)
          .set('Authorization', `Bearer ${organizerToken}`);

        expect(response.status).toBe(403);
      });
    });
  });

  describe('GET /api/admin/events - List Events', () => {
    let testEvent1, testEvent2;

    beforeEach(async () => {
      testEvent1 = await Event.create({
        title: 'Funding Event',
        description: 'Test Description',
        organizer: testOrganizer.walletAddress,
        status: 'funding',
        fundingGoal: '1000000000000000000',
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        totalTickets: 100
      });

      testEvent2 = await Event.create({
        title: 'Completed Event',
        description: 'Test Description 2',
        organizer: testOrganizer.walletAddress,
        status: 'completed',
        fundingGoal: '2000000000000000000',
        startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        totalTickets: 200
      });
    });

    describe('Happy Path', () => {
      it('should return paginated list of all events', async () => {
        const response = await request(app)
          .get('/api/admin/events')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('docs');
        expect(response.body.data).toHaveProperty('totalDocs');
        expect(Array.isArray(response.body.data.docs)).toBe(true);
        expect(response.body.data.docs.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter events by status', async () => {
        const response = await request(app)
          .get('/api/admin/events?status=funding')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        // Bắt buộc phải có data để tránh pass giả với mảng rỗng
        expect(response.body.data.docs.length).toBeGreaterThan(0);
        expect(response.body.data.docs.every(event => event.status === 'funding')).toBe(true);
      });

      it('should filter events by organizer', async () => {
        const response = await request(app)
          .get(`/api/admin/events?organizer=${testOrganizer.walletAddress}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        // Bắt buộc phải có data để tránh pass giả với mảng rỗng
        expect(response.body.data.docs.length).toBeGreaterThan(0);
        expect(response.body.data.docs.every(
          event => event.organizer === testOrganizer.walletAddress.toLowerCase()
        )).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/admin/events?page=1&limit=1')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.limit).toBe(1);
        expect(response.body.data.page).toBe(1);
        // Kiểm tra số lượng phần tử thực tế trong mảng docs
        expect(response.body.data.docs.length).toBe(1);

        // Verify totalDocs và totalPages
        expect(response.body.data.totalDocs).toBeGreaterThanOrEqual(2);
        expect(response.body.data.totalPages).toBeGreaterThanOrEqual(2);
      });

      it('should support multiple filters (status + organizer)', async () => {
        const response = await request(app)
          .get(`/api/admin/events?status=funding&organizer=${testOrganizer.walletAddress}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.docs.length).toBeGreaterThan(0);
        expect(response.body.data.docs.every(event =>
          event.status === 'funding' &&
          event.organizer === testOrganizer.walletAddress.toLowerCase()
        )).toBe(true);
      });
    });

    describe('Authentication & Authorization', () => {
      it('should return 401 for unauthenticated requests', async () => {
        const response = await request(app)
          .get('/api/admin/events');

        expect(response.status).toBe(401);
      });

      it('should return 403 for non-admin users', async () => {
        const response = await request(app)
          .get('/api/admin/events')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(403);
      });
    });
  });

  describe('PATCH /api/admin/events/:id/status - Update Event Status', () => {
    let testEvent;

    beforeEach(async () => {
      testEvent = await Event.create({
        title: 'Test Event',
        description: 'Test Description',
        organizer: testOrganizer.walletAddress,
        status: 'funding',
        fundingGoal: '1000000000000000000',
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        totalTickets: 100
      });
    });

    describe('Happy Path', () => {
      it('should successfully update event status to completed', async () => {
        const response = await request(app)
          .patch(`/api/admin/events/${testEvent._id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'completed' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('completed');

        // Verify in database
        const updatedEvent = await Event.findById(testEvent._id);
        expect(updatedEvent.status).toBe('completed');
      });

      it('should successfully update event status to cancelled', async () => {
        const response = await request(app)
          .patch(`/api/admin/events/${testEvent._id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'cancelled' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('cancelled');
      });

      it('should successfully update event status to failed', async () => {
        const response = await request(app)
          .patch(`/api/admin/events/${testEvent._id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'failed' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('failed');
      });

      it('should successfully update event status to ongoing', async () => {
        const response = await request(app)
          .patch(`/api/admin/events/${testEvent._id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'ongoing' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('ongoing');
      });
    });

    describe('Business Logic Errors', () => {
      it('should return 404 when event does not exist', async () => {
        const nonExistentId = '507f1f77bcf86cd799439011';

        const response = await request(app)
          .patch(`/api/admin/events/${nonExistentId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'completed' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('Event not found');
      });

      it('should return 400 for missing status field', async () => {
        const response = await request(app)
          .patch(`/api/admin/events/${testEvent._id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 for invalid status value', async () => {
        const response = await request(app)
          .patch(`/api/admin/events/${testEvent._id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'pending' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 for empty status string', async () => {
        const response = await request(app)
          .patch(`/api/admin/events/${testEvent._id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: '' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 for null status', async () => {
        const response = await request(app)
          .patch(`/api/admin/events/${testEvent._id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: null });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('Authentication & Authorization', () => {
      it('should return 401 for unauthenticated requests', async () => {
        const response = await request(app)
          .patch(`/api/admin/events/${testEvent._id}/status`)
          .send({ status: 'completed' });

        expect(response.status).toBe(401);
      });

      it('should return 403 for non-admin users', async () => {
        const response = await request(app)
          .patch(`/api/admin/events/${testEvent._id}/status`)
          .set('Authorization', `Bearer ${organizerToken}`)
          .send({ status: 'completed' });

        expect(response.status).toBe(403);
      });
    });
  });

  describe('GET /api/admin/health - System Health', () => {
    describe('Happy Path', () => {
      it('should return system health status', async () => {
        const response = await request(app)
          .get('/api/admin/health')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('database');
        expect(response.body.data).toHaveProperty('services');
        expect(response.body.data).toHaveProperty('timestamp');
        expect(response.body.data.database).toHaveProperty('status');
        expect(response.body.data.database).toHaveProperty('connected');
        expect(response.body.data.database.connected).toBe(true);
      });
    });

    describe('Authentication & Authorization', () => {
      it('should return 401 for unauthenticated requests', async () => {
        const response = await request(app)
          .get('/api/admin/health');

        expect(response.status).toBe(401);
      });

      it('should return 403 for non-admin users', async () => {
        const response = await request(app)
          .get('/api/admin/health')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(403);
      });
    });
  });
});
