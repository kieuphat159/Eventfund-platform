/**
 * E2E Integration Tests for Events Routes
 * Focus: Happy Path & Business Logic Errors
 *
 * Test Strategy:
 * - Happy Path: Verify complete event lifecycle with valid data
 * - Business Logic Errors: Test domain-specific error conditions
 * - Event Management: Test CRUD operations and business rules
 *
 * Requirements: 2.5, 8.6
 */

import request from 'supertest';
import app from '../../../app.js';
import User from '../../../models/User.model.js';
import Event from '../../../models/Event.model.js';
import JWTService from '../../../services/auth/jwt.service.js';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../../helpers/db.helper.js';

// Set JWT_SECRET explicitly for test environment to avoid dependency on .env
process.env.JWT_SECRET = 'test-secret-key-for-integration-tests-do-not-use-in-production';

const jwtService = new JWTService();

describe('Events Routes - E2E Integration Tests', () => {
  let organizerToken;
  let userToken;
  let verifierToken;
  let organizerUser;
  let regularUser;
  let verifierUser;
  let anotherOrganizerToken;
  let anotherOrganizerUser;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create test users
    organizerUser = await User.create({
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      role: 'organizer',
      nonce: 'test-nonce-organizer',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    regularUser = await User.create({
      walletAddress: '0x123d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
      role: 'user',
      nonce: 'test-nonce-user',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    verifierUser = await User.create({
      walletAddress: '0x555d35Cc6634C0532925a3b844Bc9e7595f0bEb5',
      role: 'verifier',
      nonce: 'test-nonce-verifier',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    anotherOrganizerUser = await User.create({
      walletAddress: '0x999d35Cc6634C0532925a3b844Bc9e7595f0bEb9',
      role: 'organizer',
      nonce: 'test-nonce-organizer2',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    // Generate tokens
    organizerToken = jwtService.generateToken(organizerUser.walletAddress, organizerUser.role);
    userToken = jwtService.generateToken(regularUser.walletAddress, regularUser.role);
    verifierToken = jwtService.generateToken(verifierUser.walletAddress, verifierUser.role);
    anotherOrganizerToken = jwtService.generateToken(anotherOrganizerUser.walletAddress, anotherOrganizerUser.role);
  });

  // ============================================================================
  // HAPPY PATH TESTS - Complete Event Lifecycle
  // ============================================================================

  describe('Happy Path - Event Lifecycle', () => {
    const validEventData = {
      title: 'Web3 Developer Conference 2026',
      description: 'Annual conference for blockchain developers',
      category: 'conference',
      fundingGoal: '5000000000000000000',
      minStakeRequired: '1000000000000000000',
      fundingDeadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
      startDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 52 * 24 * 60 * 60 * 1000).toISOString(),
      totalTickets: 500,
      venue: {
        name: 'Tech Convention Center',
        address: '123 Innovation Drive',
        city: 'San Francisco',
        country: 'USA'
      }
    };

    test('should create event successfully', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(validEventData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        title: validEventData.title,
        description: validEventData.description,
        organizer: organizerUser.walletAddress.toLowerCase(),
        status: 'draft',
        currentFunding: '0',
        ticketsSold: 0
      });
      expect(response.body.data._id).toBeDefined();
    });

    test('should create event with address-only venue and ticket tiers from frontend payload', async () => {
      const frontendPayload = {
        title: 'Frontend Created Event',
        description: 'Created from the organizer dashboard form',
        category: 'art',
        fundingGoal: '0',
        minStakeRequired: '0',
        fundingDeadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        startDate: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        totalTickets: 999,
        venue: {
          address: '123 Demo Street'
        },
        ticketTiers: [
          {
            name: 'General',
            price: 99,
            totalSupply: 999
          }
        ]
      };

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${userToken}`)
        .send(frontendPayload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.venue).toMatchObject({
        address: '123 Demo Street'
      });
      expect(response.body.data.ticketTiers).toHaveLength(1);
      expect(response.body.data.ticketTiers[0]).toMatchObject({
        name: 'General',
        price: 99,
        totalSupply: 999
      });
      expect(response.body.data.organizer).toBe(regularUser.walletAddress.toLowerCase());
    });

    test('should list events with pagination', async () => {
      // Create multiple events
      await Event.create([
        { ...validEventData, organizer: organizerUser.walletAddress.toLowerCase(), status: 'draft' },
        { ...validEventData, title: 'Event 2', organizer: organizerUser.walletAddress.toLowerCase(), status: 'funding' },
        { ...validEventData, title: 'Event 3', organizer: organizerUser.walletAddress.toLowerCase(), status: 'funded' }
      ]);

      const response = await request(app)
        .get('/api/events')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(2);
      expect(response.body.data.totalDocs).toBe(3);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(2);
    });

    test('should get event by ID', async () => {
      const event = await Event.create({
        ...validEventData,
        organizer: organizerUser.walletAddress.toLowerCase(),
        status: 'draft'
      });

      const response = await request(app)
        .get(`/api/events/${event._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(event._id.toString());
      expect(response.body.data.title).toBe(validEventData.title);
    });

    test('should update event successfully', async () => {
      const event = await Event.create({
        ...validEventData,
        organizer: organizerUser.walletAddress.toLowerCase(),
        status: 'draft'
      });

      const updates = {
        title: 'Updated Conference Title',
        description: 'Updated description'
      };

      const response = await request(app)
        .patch(`/api/events/${event._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updates.title);
      expect(response.body.data.description).toBe(updates.description);
    });

    test('should update draft event with frontend edit payload', async () => {
      const event = await Event.create({
        ...validEventData,
        organizer: organizerUser.walletAddress.toLowerCase(),
        status: 'draft',
        ticketTiers: [
          {
            name: 'General',
            price: 99,
            totalSupply: 100
          }
        ]
      });

      const updates = {
        title: 'Updated Draft Event',
        description: 'Updated from edit screen',
        category: 'sports',
        startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        fundingGoal: '0',
        minStakeRequired: '0',
        fundingDeadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        totalTickets: 111,
        venue: {
          address: '456 Updated Street'
        },
        ticketTiers: [
          {
            name: 'General',
            price: 1,
            totalSupply: 111
          }
        ],
        status: 'draft'
      };

      const response = await request(app)
        .patch(`/api/events/${event._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updates.title);
      expect(response.body.data.fundingGoal).toBe(updates.fundingGoal);
      expect(response.body.data.venue).toMatchObject({ address: updates.venue.address });
      expect(response.body.data.ticketTiers[0]).toMatchObject({
        name: 'General',
        price: 1,
        totalSupply: 111
      });
    });

    test('should delete draft event successfully', async () => {
      const event = await Event.create({
        ...validEventData,
        organizer: organizerUser.walletAddress.toLowerCase(),
        status: 'draft'
      });

      const response = await request(app)
        .delete(`/api/events/${event._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Event deleted successfully');

      // Verify event is deleted
      const deletedEvent = await Event.findById(event._id);
      expect(deletedEvent).toBeNull();
    });

    test('should get event statistics', async () => {
      const event = await Event.create({
        ...validEventData,
        organizer: organizerUser.walletAddress.toLowerCase(),
        status: 'funding',
        currentFunding: '2500000000000000000',
        ticketsSold: 100,
        totalTicketsUsed: 80
      });

      const response = await request(app)
        .get(`/api/events/${event._id}/stats`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        eventId: event._id.toString(),
        fundingProgress: 50,
        currentFunding: '2500000000000000000',
        fundingGoal: validEventData.fundingGoal,
        ticketsSold: 100,
        ticketsAvailable: 400,
        totalTickets: 500,
        totalTicketsUsed: 80,
        ticketUsageRate: 80
      });
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Authorization & Ownership
  // ============================================================================

  describe('Business Logic Errors - Authorization', () => {
    const validEventData = {
      title: 'Test Event',
      description: 'Test description',
      category: 'conference',
      fundingGoal: '5000000000000000000',
      minStakeRequired: '1000000000000000000',
      fundingDeadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
      startDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 52 * 24 * 60 * 60 * 1000).toISOString(),
      totalTickets: 500
    };

    test('should reject event creation without authentication', async () => {
      const response = await request(app)
        .post('/api/events')
        .send(validEventData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toContain('Authentication required');
    });

    test('should reject event creation for verifier role', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${verifierToken}`)
        .send(validEventData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
      // Verify the error is specifically about role, not other authorization issues
      const errorMsg = response.body.error.message.toLowerCase();
      expect(
        errorMsg.includes('permission') ||
        errorMsg.includes('organizer') ||
        errorMsg.includes('role')
      ).toBe(true);
    });

    test('should reject update by non-owner organizer', async () => {
      const event = await Event.create({
        ...validEventData,
        organizer: organizerUser.walletAddress.toLowerCase(),
        status: 'draft'
      });

      const response = await request(app)
        .patch(`/api/events/${event._id}`)
        .set('Authorization', `Bearer ${anotherOrganizerToken}`)
        .send({ title: 'Unauthorized Update' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
      // Verify the error is specifically about ownership, not other issues
      const errorMsg = response.body.error.message.toLowerCase();
      expect(
        errorMsg.includes('not authorized') ||
        errorMsg.includes('owner') ||
        errorMsg.includes('permission')
      ).toBe(true);
    });

    test('should reject delete by non-owner organizer', async () => {
      const event = await Event.create({
        ...validEventData,
        organizer: organizerUser.walletAddress.toLowerCase(),
        status: 'draft'
      });

      const response = await request(app)
        .delete(`/api/events/${event._id}`)
        .set('Authorization', `Bearer ${anotherOrganizerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
      // Verify the error is specifically about ownership
      const errorMsg = response.body.error.message.toLowerCase();
      expect(
        errorMsg.includes('not authorized') ||
        errorMsg.includes('owner') ||
        errorMsg.includes('permission')
      ).toBe(true);
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Event Status Rules
  // ============================================================================

  describe('Business Logic Errors - Event Status Rules', () => {
    const validEventData = {
      title: 'Test Event',
      description: 'Test description',
      category: 'conference',
      fundingGoal: '5000000000000000000',
      minStakeRequired: '1000000000000000000',
      fundingDeadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
      startDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 52 * 24 * 60 * 60 * 1000).toISOString(),
      totalTickets: 500
    };

    test('should reject deleting non-draft event', async () => {
      const event = await Event.create({
        ...validEventData,
        organizer: organizerUser.walletAddress.toLowerCase(),
        status: 'funding'
      });

      const response = await request(app)
        .delete(`/api/events/${event._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
      // Verify the error is specifically about event status, not other validation issues
      const errorMsg = response.body.error.message.toLowerCase();
      expect(
        errorMsg.includes('draft') ||
        errorMsg.includes('status')
      ).toBe(true);
    });

    test('should reject changing funding goal after funding starts', async () => {
      const event = await Event.create({
        ...validEventData,
        organizer: organizerUser.walletAddress.toLowerCase(),
        status: 'funding'
      });

      const response = await request(app)
        .patch(`/api/events/${event._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ fundingGoal: '10000000000000000000' })
        .expect(400);

      expect(response.body.success).toBe(false);
      // Verify the error is specifically about funding goal modification
      const errorMsg = response.body.error.message.toLowerCase();
      expect(
        errorMsg.includes('funding') ||
        errorMsg.includes('goal') ||
        errorMsg.includes('cannot')
      ).toBe(true);
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Validation Errors
  // ============================================================================

  describe('Business Logic Errors - Validation', () => {
    test('should reject event with missing required fields', async () => {
      const invalidData = {
        title: 'Test Event'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBeDefined();
      // Verify it's a validation error, not other types of errors
      const errorMsg = response.body.error.message.toLowerCase();
      expect(
        errorMsg.includes('required') ||
        errorMsg.includes('validation') ||
        errorMsg.includes('missing')
      ).toBe(true);
    });

    test('should reject event with invalid date range', async () => {
      const invalidData = {
        title: 'Test Event',
        description: 'Test description',
        category: 'conference',
        fundingGoal: '5000000000000000000',
        minStakeRequired: '1000000000000000000',
        fundingDeadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
        startDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Before start date
        venue: {
          name: 'Test Venue',
          address: '123 Test St'
        },
        totalTickets: 500
      };

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      // Verify the error is specifically about date validation
      const errorMsg = response.body.error.message.toLowerCase();
      expect(
        errorMsg.includes('date') ||
        errorMsg.includes('before') ||
        errorMsg.includes('after')
      ).toBe(true);
    });

    test('should reject event with negative total tickets', async () => {
      const invalidData = {
        title: 'Test Event',
        description: 'Test description',
        category: 'conference',
        fundingGoal: '5000000000000000000',
        minStakeRequired: '1000000000000000000',
        fundingDeadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
        startDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 52 * 24 * 60 * 60 * 1000).toISOString(),
        venue: {
          name: 'Test Venue',
          address: '123 Test St'
        },
        totalTickets: -100
      };

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      // Verify the error is specifically about ticket validation
      const errorMsg = response.body.error.message.toLowerCase();
      expect(
        errorMsg.includes('ticket') ||
        errorMsg.includes('positive') ||
        errorMsg.includes('greater')
      ).toBe(true);
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Not Found Errors
  // ============================================================================

  describe('Business Logic Errors - Not Found', () => {
    test('should return 404 for non-existent event', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/events/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('Event not found');
    });

    test('should return 404 when updating non-existent event', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .patch(`/api/events/${fakeId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ title: 'Updated Title' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('Event not found');
    });

    test('should return 404 when deleting non-existent event', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .delete(`/api/events/${fakeId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('Event not found');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC - Filtering & Sorting
  // ============================================================================

  describe('Business Logic - Filtering & Sorting', () => {
    beforeEach(async () => {
      const baseEvent = {
        description: 'Test description',
        fundingGoal: '5000000000000000000',
        minStakeRequired: '1000000000000000000',
        fundingDeadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
        startDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 52 * 24 * 60 * 60 * 1000),
        totalTickets: 500
      };

      await Event.create([
        { ...baseEvent, title: 'Conference 1', organizer: organizerUser.walletAddress.toLowerCase(), status: 'draft', category: 'conference' },
        { ...baseEvent, title: 'Workshop 1', organizer: organizerUser.walletAddress.toLowerCase(), status: 'funding', category: 'workshop' },
        { ...baseEvent, title: 'Conference 2', organizer: anotherOrganizerUser.walletAddress.toLowerCase(), status: 'funded', category: 'conference' }
      ]);
    });

    test('should filter events by status', async () => {
      const response = await request(app)
        .get('/api/events')
        .query({ status: 'funding' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(1);
      expect(response.body.data.docs[0].status).toBe('funding');
    });

    test('should filter events by category', async () => {
      const response = await request(app)
        .get('/api/events')
        .query({ category: 'conference' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(2);
      expect(response.body.data.docs.every(e => e.category === 'conference')).toBe(true);
    });

    test('should filter events by organizer', async () => {
      const response = await request(app)
        .get('/api/events')
        .query({ organizer: organizerUser.walletAddress })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(2);
      expect(response.body.data.docs.every(e =>
        e.organizer.toLowerCase() === organizerUser.walletAddress.toLowerCase()
      )).toBe(true);
    });

    test('should respect pagination limit', async () => {
      const response = await request(app)
        .get('/api/events')
        .query({ limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(2);
      expect(response.body.data.limit).toBe(2);
    });

    test('should enforce maximum limit of 100', async () => {
      const response = await request(app)
        .get('/api/events')
        .query({ limit: 200 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      // Verify the error is specifically about limit validation
      const errorMsg = response.body.error.message.toLowerCase();
      expect(
        errorMsg.includes('limit') ||
        errorMsg.includes('100') ||
        errorMsg.includes('maximum')
      ).toBe(true);
    });
  });
});
