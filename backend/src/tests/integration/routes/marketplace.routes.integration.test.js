/**
 * E2E Integration Tests for Marketplace Routes
 * Focus: Happy Path & Business Logic Errors
 *
 * Test Strategy:
 * - Happy Path: Verify complete marketplace lifecycle with valid data
 * - Business Logic Errors: Test domain-specific error conditions
 * - Marketplace Management: Test listing CRUD operations and business rules
 *
 * Requirements: 3.3, 3.4
 */

import request from 'supertest';
import app from '../../../app.js';
import User from '../../../models/User.model.js';
import Event from '../../../models/Event.model.js';
import Ticket from '../../../models/Ticket.model.js';
import Listing from '../../../models/Listing.model.js';
import JWTService from '../../../services/auth/jwt.service.js';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../../helpers/db.helper.js';

const jwtService = new JWTService();

describe('Marketplace Routes - E2E Integration Tests', () => {
  let sellerToken;
  let buyerToken;
  let sellerUser;
  let buyerUser;
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
    sellerUser = await User.create({
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      role: 'user',
      nonce: 'test-nonce-seller',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    buyerUser = await User.create({
      walletAddress: '0x123d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
      role: 'user',
      nonce: 'test-nonce-buyer',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    // Generate tokens
    sellerToken = jwtService.generateToken(sellerUser.walletAddress, sellerUser.role);
    buyerToken = jwtService.generateToken(buyerUser.walletAddress, buyerUser.role);

    // Create test event
    testEvent = await Event.create({
      title: 'Test Concert',
      description: 'Test event for marketplace',
      category: 'concert',
      organizer: '0x999d35Cc6634C0532925a3b844Bc9e7595f0bEb9',
      fundingGoal: '5000000000000000000',
      minStakeRequired: '1000000000000000000',
      fundingDeadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      startDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 52 * 24 * 60 * 60 * 1000),
      totalTickets: 500,
      status: 'funded'
    });

    // Create test ticket owned by seller
    testTicket = await Ticket.create({
      tokenId: '1',
      eventId: testEvent._id,
      currentOwner: sellerUser.walletAddress.toLowerCase(),
      originalPrice: '1000000000000000000',
      status: 'sold',
      isListed: false,
      transferHistory: [{
        from: '0x0000000000000000000000000000000000000000',
        to: sellerUser.walletAddress.toLowerCase(),
        txHash: '0xabc123',
        timestamp: new Date(),
        type: 'mint'
      }]
    });
  });

  // ============================================================================
  // HAPPY PATH TESTS - Complete Marketplace Lifecycle
  // ============================================================================

  describe('Happy Path - Marketplace Lifecycle', () => {
    const validListingData = {
      ticketId: '',
      price: '1200000000000000000',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    test('should create listing successfully', async () => {
      validListingData.ticketId = testTicket._id.toString();

      const response = await request(app)
        .post('/api/marketplace/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(validListingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        ticketId: testTicket._id.toString(),
        seller: sellerUser.walletAddress.toLowerCase(),
        price: validListingData.price,
        status: 'active'
      });
      expect(response.body.data._id).toBeDefined();

      // Verify ticket is marked as listed
      const updatedTicket = await Ticket.findById(testTicket._id);
      expect(updatedTicket.isListed).toBe(true);
    });

    test('should list all marketplace listings', async () => {
      // Create multiple listings
      const ticket2 = await Ticket.create({
        tokenId: '2',
        eventId: testEvent._id,
        currentOwner: sellerUser.walletAddress.toLowerCase(),
        originalPrice: '1000000000000000000',
        status: 'sold',
        isListed: false
      });

      await Listing.create([
        {
          ticketId: testTicket._id,
          tokenId: testTicket.tokenId,
          eventId: testEvent._id,
          seller: sellerUser.walletAddress.toLowerCase(),
          price: '1200000000000000000',
          maxPrice: '1500000000000000000',
          status: 'active',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          ticketId: ticket2._id,
          tokenId: ticket2.tokenId,
          eventId: testEvent._id,
          seller: sellerUser.walletAddress.toLowerCase(),
          price: '1100000000000000000',
          maxPrice: '1500000000000000000',
          status: 'active',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      ]);

      const response = await request(app)
        .get('/api/marketplace/listings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(2);
      expect(response.body.data.totalDocs).toBe(2);
    });

    test('should get listing by ID', async () => {
      const listing = await Listing.create({
        ticketId: testTicket._id,
        tokenId: testTicket.tokenId,
        eventId: testEvent._id,
        seller: sellerUser.walletAddress.toLowerCase(),
        price: '1200000000000000000',
        maxPrice: '1500000000000000000',
        status: 'active',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      const response = await request(app)
        .get(`/api/marketplace/listings/${listing._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(listing._id.toString());
      expect(response.body.data.price).toBe('1200000000000000000');
    });

    test('should cancel listing successfully', async () => {
      const listing = await Listing.create({
        ticketId: testTicket._id,
        tokenId: testTicket.tokenId,
        eventId: testEvent._id,
        seller: sellerUser.walletAddress.toLowerCase(),
        price: '1200000000000000000',
        maxPrice: '1500000000000000000',
        status: 'active',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      await Ticket.findByIdAndUpdate(testTicket._id, { isListed: true });

      const response = await request(app)
        .delete(`/api/marketplace/listings/${listing._id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');

      // Verify ticket is no longer listed
      const updatedTicket = await Ticket.findById(testTicket._id);
      expect(updatedTicket.isListed).toBe(false);
    });

    test('should get marketplace statistics', async () => {
      await Listing.create([
        {
          ticketId: testTicket._id,
          tokenId: testTicket.tokenId,
          eventId: testEvent._id,
          seller: sellerUser.walletAddress.toLowerCase(),
          price: '1200000000000000000',
          maxPrice: '1500000000000000000',
          status: 'active',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          ticketId: testTicket._id,
          tokenId: '2',
          eventId: testEvent._id,
          seller: sellerUser.walletAddress.toLowerCase(),
          price: '1100000000000000000',
          maxPrice: '1500000000000000000',
          status: 'sold',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      ]);

      const response = await request(app)
        .get('/api/marketplace/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalListings: 2,
        activeListings: 1,
        soldListings: 1
      });
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Authorization & Ownership
  // ============================================================================

  describe('Business Logic Errors - Authorization', () => {
    test('should reject listing creation without authentication', async () => {
      const listingData = {
        ticketId: testTicket._id.toString(),
        price: '1200000000000000000',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/marketplace/listings')
        .send(listingData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Authentication required');
    });

    test('should reject listing ticket not owned by user', async () => {
      const listingData = {
        ticketId: testTicket._id.toString(),
        price: '1200000000000000000',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/marketplace/listings')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send(listingData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Not authorized to list this ticket');
    });

    test('should reject cancelling listing by non-owner', async () => {
      const listing = await Listing.create({
        ticketId: testTicket._id,
        tokenId: testTicket.tokenId,
        eventId: testEvent._id,
        seller: sellerUser.walletAddress.toLowerCase(),
        price: '1200000000000000000',
        maxPrice: '1500000000000000000',
        status: 'active',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      const response = await request(app)
        .delete(`/api/marketplace/listings/${listing._id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Not authorized to cancel this listing');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Ticket Status Rules
  // ============================================================================

  describe('Business Logic Errors - Ticket Status Rules', () => {
    test('should reject listing ticket that is not sold', async () => {
      const mintedTicket = await Ticket.create({
        tokenId: '99',
        eventId: testEvent._id,
        currentOwner: sellerUser.walletAddress.toLowerCase(),
        originalPrice: '1000000000000000000',
        status: 'minted',
        isListed: false
      });

      const listingData = {
        ticketId: mintedTicket._id.toString(),
        price: '1200000000000000000',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/marketplace/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(listingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Ticket must be in sold status');
    });

    test('should reject listing already listed ticket', async () => {
      await Ticket.findByIdAndUpdate(testTicket._id, { isListed: true });

      const listingData = {
        ticketId: testTicket._id.toString(),
        price: '1200000000000000000',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/marketplace/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(listingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Ticket is already listed');
    });

    test('should reject cancelling non-active listing', async () => {
      const listing = await Listing.create({
        ticketId: testTicket._id,
        tokenId: testTicket.tokenId,
        eventId: testEvent._id,
        seller: sellerUser.walletAddress.toLowerCase(),
        price: '1200000000000000000',
        maxPrice: '1500000000000000000',
        status: 'sold',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      const response = await request(app)
        .delete(`/api/marketplace/listings/${listing._id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Listing is not active');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Price Validation
  // ============================================================================

  describe('Business Logic Errors - Price Validation', () => {
    test('should reject price exceeding maximum allowed (150% of original)', async () => {
      const listingData = {
        ticketId: testTicket._id.toString(),
        price: '2000000000000000000', // 200% of original price
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/marketplace/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(listingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Price exceeds maximum allowed');
    });

    test('should accept price at maximum allowed (150% of original)', async () => {
      const listingData = {
        ticketId: testTicket._id.toString(),
        price: '1500000000000000000', // Exactly 150% of original price
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/marketplace/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(listingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.price).toBe('1500000000000000000');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC ERRORS - Not Found Errors
  // ============================================================================

  describe('Business Logic Errors - Not Found', () => {
    test('should return 404 for non-existent ticket', async () => {
      const fakeTicketId = '507f1f77bcf86cd799439011';

      const listingData = {
        ticketId: fakeTicketId,
        price: '1200000000000000000',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/marketplace/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(listingData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Ticket not found');
    });

    test('should return 404 for non-existent listing', async () => {
      const fakeListingId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/marketplace/listings/${fakeListingId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Listing not found');
    });

    test('should return 404 when cancelling non-existent listing', async () => {
      const fakeListingId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .delete(`/api/marketplace/listings/${fakeListingId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Listing not found');
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

      // Create separate tickets to avoid unique constraint violations
      const ticket2 = await Ticket.create({
        tokenId: '2',
        eventId: event2._id,
        currentOwner: buyerUser.walletAddress.toLowerCase(),
        originalPrice: '1000000000000000000',
        status: 'sold',
        isListed: false
      });

      const ticket3 = await Ticket.create({
        tokenId: '3',
        eventId: testEvent._id,
        currentOwner: sellerUser.walletAddress.toLowerCase(),
        originalPrice: '1000000000000000000',
        status: 'sold',
        isListed: false
      });

      await Listing.create([
        {
          ticketId: testTicket._id,
          tokenId: '1',
          eventId: testEvent._id,
          seller: sellerUser.walletAddress.toLowerCase(),
          price: '1200000000000000000',
          maxPrice: '1500000000000000000',
          status: 'active',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          ticketId: ticket2._id,
          tokenId: '2',
          eventId: event2._id,
          seller: buyerUser.walletAddress.toLowerCase(),
          price: '800000000000000000',
          maxPrice: '1500000000000000000',
          status: 'active',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          ticketId: ticket3._id,
          tokenId: '3',
          eventId: testEvent._id,
          seller: sellerUser.walletAddress.toLowerCase(),
          price: '1500000000000000000',
          maxPrice: '1500000000000000000',
          status: 'sold',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      ]);
    });

    test('should filter listings by status', async () => {
      const response = await request(app)
        .get('/api/marketplace/listings')
        .query({ status: 'active' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(2);
      expect(response.body.data.docs.every(l => l.status === 'active')).toBe(true);
    });

    test('should filter listings by eventId', async () => {
      const response = await request(app)
        .get('/api/marketplace/listings')
        .query({ eventId: testEvent._id.toString() })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Must have exactly 1 active listing for testEvent (tokenId: '1')
      expect(response.body.data.docs).toHaveLength(1);
      // eventId is populated, so compare with _id property
      expect(response.body.data.docs.every(l =>
        (typeof l.eventId === 'object' ? l.eventId._id : l.eventId).toString() === testEvent._id.toString()
      )).toBe(true);
    });

    test('should filter listings by price range', async () => {
      const response = await request(app)
        .get('/api/marketplace/listings')
        .query({
          minPrice: '1000000000000000000',
          maxPrice: '1300000000000000000'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Must have exactly 2 listings in this price range (tokenId: '1' at 1.2 ETH and tokenId: '2' at 0.8 ETH is excluded)
      // Actually tokenId '2' is 0.8 ETH (below min), so only tokenId '1' at 1.2 ETH matches
      expect(response.body.data.docs).toHaveLength(1);
      expect(response.body.data.docs.every(l => {
        const price = BigInt(l.price);
        return price >= BigInt('1000000000000000000') && price <= BigInt('1300000000000000000');
      })).toBe(true);
    });

    test('should respect pagination limit', async () => {
      const response = await request(app)
        .get('/api/marketplace/listings')
        .query({ limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.docs).toHaveLength(2);
      // Verify the limit is correctly returned in metadata
      expect(response.body.data.limit).toBe(2);
    });

    test('should enforce maximum limit of 100', async () => {
      const response = await request(app)
        .get('/api/marketplace/listings')
        .query({ limit: 200 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      // Validator rejects limit > 100
      expect(response.body.error.details).toBeDefined();
      expect(Array.isArray(response.body.error.details)).toBe(true);
      const detail = response.body.error.details.find(d => d.field === 'limit');
      expect(detail).toBeDefined();
    });

    test('should paginate results correctly', async () => {
      // Note: Default query returns only 'active' status, so only 2 out of 3 listings
      const page1 = await request(app)
        .get('/api/marketplace/listings')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(page1.body.data.docs.length).toBeGreaterThan(0);
      expect(page1.body.data.page).toBe(1);
      expect(page1.body.data.totalDocs).toBe(2); // Only 2 active listings

      // Verify pagination metadata exists
      expect(page1.body.data).toHaveProperty('totalPages');
      expect(page1.body.data).toHaveProperty('hasNextPage');
      expect(page1.body.data).toHaveProperty('hasPrevPage');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC - Validation Errors
  // ============================================================================

  describe('Business Logic - Validation Errors', () => {
    test('should reject listing with missing required fields', async () => {
      const invalidData = {
        ticketId: testTicket._id.toString()
        // Missing price and expiresAt
      };

      const response = await request(app)
        .post('/api/marketplace/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject listing with invalid price format', async () => {
      const invalidData = {
        ticketId: testTicket._id.toString(),
        price: 'not-a-number',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/marketplace/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject listing with invalid ticketId format', async () => {
      const invalidData = {
        ticketId: 'invalid-id',
        price: '1200000000000000000',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/marketplace/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject listing with invalid expiresAt format', async () => {
      const invalidData = {
        ticketId: testTicket._id.toString(),
        price: '1200000000000000000',
        expiresAt: 'not-a-date'
      };

      const response = await request(app)
        .post('/api/marketplace/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
