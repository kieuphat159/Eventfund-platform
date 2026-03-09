/**
 * E2E Integration Tests for Tickets Routes
 * Focus: Happy Path & Business Logic Errors
 *
 * Test Strategy:
 * - Happy Path: Verify complete ticket lifecycle with valid data
 * - Business Logic Errors: Test domain-specific error conditions
 * - Ticket Management: Test ticket CRUD operations and business rules
 *
 * Requirements: 3.5, 8.6
 */

import request from 'supertest';
import app from '../../../app.js';
import User from '../../../models/User.model.js';
import Event from '../../../models/Event.model.js';
import Ticket from '../../../models/Ticket.model.js';
import JWTService from '../../../services/auth/jwt.service.js';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../../helpers/db.helper.js';

const jwtService = new JWTService();

describe('Tickets Routes - E2E Integration Tests', () => {
  let verifierToken;
  let userToken;
  let verifierUser;
  let regularUser;
  let testEvent;
  let testTicket;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create test users
    verifierUser = await User.create({
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      role: 'verifier',
      nonce: 'test-nonce-verifier',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    regularUser = await User.create({
      walletAddress: '0x123d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
      role: 'user',
      nonce: 'test-nonce-user',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    // Generate tokens
    verifierToken = jwtService.generateToken(verifierUser.walletAddress, verifierUser.role);
    userToken = jwtService.generateToken(regularUser.walletAddress, regularUser.role);

    // Create test event with ongoing status
    testEvent = await Event.create({
      title: 'Test Concert',
      description: 'Test event for tickets',
      category: 'concert',
      organizer: '0x999d35Cc6634C0532925a3b844Bc9e7595f0bEb9',
      fundingGoal: '5000000000000000000',
      minStakeRequired: '1000000000000000000',
      fundingDeadline: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      startDate: new Date(Date.now() - 1 * 60 * 60 * 1000), // Started 1 hour ago
      endDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // Ends in 2 hours
      totalTickets: 500,
      status: 'ongoing'
    });

    // Create test ticket owned by regular user
    testTicket = await Ticket.create({
      tokenId: '1',
      eventId: testEvent._id,
      currentOwner: regularUser.walletAddress.toLowerCase(),
      originalPrice: '1000000000000000000',
      status: 'sold',
      isListed: false,
      soldAt: new Date(),
      transferHistory: [{
        from: '0x0000000000000000000000000000000000000000',
        to: regularUser.walletAddress.toLowerCase(),
        txHash: '0xabc123',
        timestamp: new Date(),
        type: 'mint'
      }]
    });
  });

  // ============================================================================
  // HAPPY PATH TESTS - Complete Ticket Lifecycle
  // ============================================================================

  describe('Happy Path - Ticket Lifecycle', () => {
    test('should list all tickets with pagination', async () => {
      // Create additional tickets
      await Ticket.create([
        {
          tokenId: '2',
          eventId: testEvent._id,
          currentOwner: regularUser.walletAddress.toLowerCase(),
          originalPrice: '1000000000000000000',
          status: 'sold',
          isListed: false
        },
        {
          tokenId: '3',
          eventId: testEvent._id,
          currentOwner: verifierUser.walletAddress.toLowerCase(),
          originalPrice: '1000000000000000000',
          status: 'minted',
          isListed: false
        }
      ]);

      const response = await request(app)
        .get('/api/tickets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(3);
      expect(response.body.data.totalDocs).toBe(3);
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('limit');
    });

    test('should get ticket by tokenId', async () => {
      const response = await request(app)
        .get(`/api/tickets/${testTicket.tokenId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokenId).toBe(testTicket.tokenId);
      expect(response.body.data.currentOwner).toBe(regularUser.walletAddress.toLowerCase());
      expect(response.body.data.status).toBe('sold');
    });

    test('should get user tickets by wallet address', async () => {
      // Create another ticket for the same user
      await Ticket.create({
        tokenId: '2',
        eventId: testEvent._id,
        currentOwner: regularUser.walletAddress.toLowerCase(),
        originalPrice: '1000000000000000000',
        status: 'sold',
        isListed: false
      });

      const response = await request(app)
        .get(`/api/tickets/user/${regularUser.walletAddress}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(2);
      expect(response.body.data.docs.every(t =>
        t.currentOwner === regularUser.walletAddress.toLowerCase()
      )).toBe(true);
    });

    test('should verify ticket ownership successfully', async () => {
      const verifyData = {
        tokenId: testTicket.tokenId,
        eventId: testEvent._id.toString(),
        walletAddress: regularUser.walletAddress
      };

      const response = await request(app)
        .post('/api/tickets/verify')
        .set('Authorization', `Bearer ${verifierToken}`)
        .send(verifyData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isOwner).toBe(true);
      expect(response.body.data.ticket.tokenId).toBe(testTicket.tokenId);
    });

    test('should mark ticket as used successfully', async () => {
      const response = await request(app)
        .post(`/api/tickets/${testTicket.tokenId}/use`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({ tokenId: testTicket.tokenId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('used');
      expect(response.body.data.usedAt).toBeDefined();
      expect(response.body.data.verifiedBy).toBe(verifierUser.walletAddress.toLowerCase());

      // Verify ticket is actually updated in database
      const updatedTicket = await Ticket.findById(testTicket._id);
      expect(updatedTicket.status).toBe('used');
    });

    test('should get ticket statistics for event', async () => {
      // Create tickets with different statuses
      await Ticket.create([
        {
          tokenId: '2',
          eventId: testEvent._id,
          currentOwner: regularUser.walletAddress.toLowerCase(),
          originalPrice: '1000000000000000000',
          status: 'minted',
          isListed: false
        },
        {
          tokenId: '3',
          eventId: testEvent._id,
          currentOwner: verifierUser.walletAddress.toLowerCase(),
          originalPrice: '1000000000000000000',
          status: 'used',
          isListed: false
        }
      ]);

      const response = await request(app)
        .get(`/api/tickets/event/${testEvent._id}/stats`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalTickets: 3,
        soldTickets: 1,
        usedTickets: 1,
        mintedTickets: 1
      });
    });

    test('should mark ticket as used idempotently', async () => {
      // First use
      await request(app)
        .post(`/api/tickets/${testTicket.tokenId}/use`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({ tokenId: testTicket.tokenId })
        .expect(200);

      // Second use (should be idempotent)
      const response = await request(app)
        .post(`/api/tickets/${testTicket.tokenId}/use`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({ tokenId: testTicket.tokenId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('used');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Authorization
  // ============================================================================

  describe('Business Logic Errors - Authorization', () => {
    test('should reject ticket verification without authentication', async () => {
      const verifyData = {
        tokenId: testTicket.tokenId,
        eventId: testEvent._id.toString(),
        walletAddress: regularUser.walletAddress
      };

      const response = await request(app)
        .post('/api/tickets/verify')
        .send(verifyData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Authentication required');
    });

    test('should reject ticket verification by non-verifier user', async () => {
      const verifyData = {
        tokenId: testTicket.tokenId,
        eventId: testEvent._id.toString(),
        walletAddress: regularUser.walletAddress
      };

      const response = await request(app)
        .post('/api/tickets/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .send(verifyData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Insufficient permissions');
    });

    test('should reject marking ticket as used without authentication', async () => {
      const response = await request(app)
        .post(`/api/tickets/${testTicket.tokenId}/use`)
        .send({ tokenId: testTicket.tokenId })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Authentication required');
    });

    test('should reject marking ticket as used by non-verifier user', async () => {
      const response = await request(app)
        .post(`/api/tickets/${testTicket.tokenId}/use`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ tokenId: testTicket.tokenId })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Insufficient permissions');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Ticket Status Rules
  // ============================================================================

  describe('Business Logic Errors - Ticket Status Rules', () => {
    test('should reject marking minted ticket as used', async () => {
      const mintedTicket = await Ticket.create({
        tokenId: '99',
        eventId: testEvent._id,
        currentOwner: regularUser.walletAddress.toLowerCase(),
        originalPrice: '1000000000000000000',
        status: 'minted',
        isListed: false
      });

      const response = await request(app)
        .post(`/api/tickets/${mintedTicket.tokenId}/use`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({ tokenId: mintedTicket.tokenId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Ticket must be in sold status');
    });

    test('should reject marking ticket as used for non-ongoing event', async () => {
      const futureEvent = await Event.create({
        title: 'Future Event',
        description: 'Event not started yet',
        category: 'concert',
        organizer: '0x999d35Cc6634C0532925a3b844Bc9e7595f0bEb9',
        fundingGoal: '5000000000000000000',
        minStakeRequired: '1000000000000000000',
        fundingDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        startDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000),
        totalTickets: 500,
        status: 'funded'
      });

      const futureTicket = await Ticket.create({
        tokenId: '100',
        eventId: futureEvent._id,
        currentOwner: regularUser.walletAddress.toLowerCase(),
        originalPrice: '1000000000000000000',
        status: 'sold',
        isListed: false
      });

      const response = await request(app)
        .post(`/api/tickets/${futureTicket.tokenId}/use`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({ tokenId: futureTicket.tokenId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Event must be in ongoing status');
    });

    test('should reject marking ticket as used outside event time window', async () => {
      // Update event to be in the past
      await Event.findByIdAndUpdate(testEvent._id, {
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      const response = await request(app)
        .post(`/api/tickets/${testTicket.tokenId}/use`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({ tokenId: testTicket.tokenId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Current time must be within event dates');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Not Found Errors
  // ============================================================================

  describe('Business Logic Errors - Not Found', () => {
    test('should return 404 for non-existent ticket by tokenId', async () => {
      const response = await request(app)
        .get('/api/tickets/999999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Ticket not found');
    });

    test('should return 404 when verifying non-existent ticket', async () => {
      const verifyData = {
        tokenId: '999999',
        eventId: testEvent._id.toString(),
        walletAddress: regularUser.walletAddress
      };

      const response = await request(app)
        .post('/api/tickets/verify')
        .set('Authorization', `Bearer ${verifierToken}`)
        .send(verifyData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Ticket not found');
    });

    test('should return 404 when marking non-existent ticket as used', async () => {
      const response = await request(app)
        .post('/api/tickets/999999/use')
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({ tokenId: '999999' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Ticket not found');
    });

    test('should return 404 when marking ticket as used for non-existent event', async () => {
      // Create ticket with non-existent event
      const orphanTicket = await Ticket.create({
        tokenId: '200',
        eventId: '507f1f77bcf86cd799439011', // Non-existent event ID
        currentOwner: regularUser.walletAddress.toLowerCase(),
        originalPrice: '1000000000000000000',
        status: 'sold',
        isListed: false
      });

      const response = await request(app)
        .post(`/api/tickets/${orphanTicket.tokenId}/use`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({ tokenId: orphanTicket.tokenId })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Event not found');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC - Filtering & Pagination
  // ============================================================================

  describe('Business Logic - Filtering & Pagination', () => {
    beforeEach(async () => {
      const event2 = await Event.create({
        title: 'Another Event',
        description: 'Another test event',
        category: 'workshop',
        organizer: '0x999d35Cc6634C0532925a3b844Bc9e7595f0bEb9',
        fundingGoal: '5000000000000000000',
        minStakeRequired: '1000000000000000000',
        fundingDeadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
        startDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 52 * 24 * 60 * 60 * 1000),
        totalTickets: 500,
        status: 'funded'
      });

      await Ticket.create([
        {
          tokenId: '2',
          eventId: event2._id,
          currentOwner: verifierUser.walletAddress.toLowerCase(),
          originalPrice: '1000000000000000000',
          status: 'minted',
          isListed: false
        },
        {
          tokenId: '3',
          eventId: testEvent._id,
          currentOwner: regularUser.walletAddress.toLowerCase(),
          originalPrice: '1000000000000000000',
          status: 'used',
          isListed: false
        }
      ]);
    });

    test('should filter tickets by status', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .query({ status: 'sold' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(1);
      expect(response.body.data.docs.every(t => t.status === 'sold')).toBe(true);
    });

    test('should filter tickets by eventId', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .query({ eventId: testEvent._id.toString() })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(2);
      expect(response.body.data.docs.every(t =>
        t.eventId.toString() === testEvent._id.toString()
      )).toBe(true);
    });

    test('should filter tickets by currentOwner', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .query({ owner: regularUser.walletAddress }) // Use 'owner' not 'currentOwner'
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should have 2 tickets: tokenId '1' (from main beforeEach) and tokenId '3' (from test setup)
      expect(response.body.data.docs).toHaveLength(2);
      expect(response.body.data.docs.every(t =>
        t.currentOwner === regularUser.walletAddress.toLowerCase()
      )).toBe(true);
    });

    test('should respect pagination limit', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .query({ limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(2);
      expect(response.body.data.limit).toBe(2);
    });

    test('should enforce maximum limit of 100', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .query({ limit: 200 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
      expect(Array.isArray(response.body.error.details)).toBe(true);
      const detail = response.body.error.details.find(d => d.field === 'limit');
      expect(detail).toBeDefined();
    });

    test('should paginate results correctly', async () => {
      const page1 = await request(app)
        .get('/api/tickets')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(page1.body.data.docs.length).toBeGreaterThan(0);
      expect(page1.body.data.page).toBe(1);
      expect(page1.body.data).toHaveProperty('totalPages');
      expect(page1.body.data).toHaveProperty('hasNextPage');
      expect(page1.body.data).toHaveProperty('hasPrevPage');
    });

    test('should filter user tickets with pagination', async () => {
      const response = await request(app)
        .get(`/api/tickets/user/${regularUser.walletAddress}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      // ✅ QUAN TRỌNG: Phải kiểm tra số lượng phần tử trước khi dùng every()
      // User này có 2 vé: tokenId '1' (từ beforeEach chính) và tokenId '3' (từ beforeEach của describe block này)
      expect(response.body.data.docs).toHaveLength(2);
      expect(response.body.data.docs.every(t =>
        t.currentOwner === regularUser.walletAddress.toLowerCase()
      )).toBe(true);
    });
  });

  // ============================================================================
  // BUSINESS LOGIC - Ownership Verification
  // ============================================================================

  describe('Business Logic - Ownership Verification', () => {
    test('should return false for non-owner verification', async () => {
      const verifyData = {
        tokenId: testTicket.tokenId,
        eventId: testEvent._id.toString(),
        walletAddress: verifierUser.walletAddress // Different from actual owner
      };

      const response = await request(app)
        .post('/api/tickets/verify')
        .set('Authorization', `Bearer ${verifierToken}`)
        .send(verifyData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isOwner).toBe(false);
      expect(response.body.data.ticket.tokenId).toBe(testTicket.tokenId);
    });

    test('should verify ownership case-insensitively', async () => {
      const verifyData = {
        tokenId: testTicket.tokenId,
        eventId: testEvent._id.toString(),
        walletAddress: regularUser.walletAddress.toUpperCase() // Uppercase version
      };

      const response = await request(app)
        .post('/api/tickets/verify')
        .set('Authorization', `Bearer ${verifierToken}`)
        .send(verifyData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isOwner).toBe(true);
    });
  });

  // ============================================================================
  // BUSINESS LOGIC - Validation Errors
  // ============================================================================

  describe('Business Logic - Validation Errors', () => {
    test('should reject verification with missing required fields', async () => {
      const invalidData = {
        tokenId: testTicket.tokenId
        // Missing eventId and walletAddress
      };

      const response = await request(app)
        .post('/api/tickets/verify')
        .set('Authorization', `Bearer ${verifierToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject verification with invalid wallet address format', async () => {
      const invalidData = {
        tokenId: testTicket.tokenId,
        eventId: testEvent._id.toString(),
        walletAddress: 'invalid-address'
      };

      const response = await request(app)
        .post('/api/tickets/verify')
        .set('Authorization', `Bearer ${verifierToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject verification with invalid eventId format', async () => {
      const invalidData = {
        tokenId: testTicket.tokenId,
        eventId: 'invalid-id',
        walletAddress: regularUser.walletAddress
      };

      const response = await request(app)
        .post('/api/tickets/verify')
        .set('Authorization', `Bearer ${verifierToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject marking ticket as used with missing tokenId', async () => {
      const response = await request(app)
        .post(`/api/tickets/${testTicket.tokenId}/use`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject query with invalid page number', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .query({ page: 0 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject query with invalid status value', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .query({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
