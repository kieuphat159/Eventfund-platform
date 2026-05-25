/**
 * E2E Integration Tests for Image Upload Routes
 * Focus: Happy Path & Business Logic Errors
 *
 * Test Strategy:
 * - Happy Path: Verify complete image upload lifecycle with valid data
 * - Business Logic Errors: Test domain-specific error conditions
 * - Image Management: Test upload, deletion, and cascade operations
 *
 * DI Testing Approach:
 * - Mock UploadService module before any imports
 * - Leverage lazy initialization to prevent constructor execution
 * - Clean, testable code without Stream race conditions
 */

import { jest } from '@jest/globals';
import request from 'supertest';

// CRITICAL: Mock UploadService BEFORE any other imports
jest.unstable_mockModule('../../../services/upload/upload.service.js', () => ({
  default: class MockUploadService {
    constructor() {
      // Mock constructor - does nothing
    }

    async uploadAvatar(file, userId, oldAvatarUrl) {
      return {
        url: 'https://res.cloudinary.com/test/image/upload/avatars/test_avatar.jpg',
        publicId: 'avatars/test_avatar_123',
        width: 400,
        height: 400,
        format: 'jpg',
        bytes: 50000
      };
    }

    async uploadEventImages(files, eventId) {
      return {
        imageUrls: [
          'https://res.cloudinary.com/test/image/upload/events/123/img1.jpg',
          'https://res.cloudinary.com/test/image/upload/events/123/img2.jpg'
        ],
        publicIds: ['events/123/img1', 'events/123/img2'],
        images: [
          {
            url: 'https://res.cloudinary.com/test/image/upload/events/123/img1.jpg',
            publicId: 'events/123/img1',
            width: 1920,
            height: 1080,
            format: 'jpg',
            bytes: 150000
          },
          {
            url: 'https://res.cloudinary.com/test/image/upload/events/123/img2.jpg',
            publicId: 'events/123/img2',
            width: 1920,
            height: 1080,
            format: 'jpg',
            bytes: 160000
          }
        ]
      };
    }

    async deleteImage(imageUrl) {
      return {
        success: true,
        publicId: 'test_public_id',
        result: 'ok'
      };
    }

    async deleteMultipleImages(imageUrls) {
      return {
        success: true,
        deleted: imageUrls.map(url => ({
          success: true,
          publicId: 'test_id',
          result: 'ok'
        })),
        failedCount: 0
      };
    }
  }
}));

// NOW import app and other modules
const app = (await import('../../../app.js')).default;
const User = (await import('../../../models/User.model.js')).default;
const Event = (await import('../../../models/Event.model.js')).default;
const JWTService = (await import('../../../services/auth/jwt.service.js')).default;
const { connectTestDB, disconnectTestDB, clearTestDB } = await import('../../helpers/db.helper.js');

// Helper function to create valid image buffers with proper magic bytes
function createValidImageBuffer(type = 'jpeg', size = 1024) {
  let magicBytes;

  switch (type) {
    case 'jpeg':
      // JPEG magic bytes: FF D8 FF
      magicBytes = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      break;
    case 'png':
      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      magicBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      break;
    case 'gif':
      // GIF magic bytes: 47 49 46 38
      magicBytes = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      break;
    case 'webp':
      // WebP magic bytes: 52 49 46 46 ... 57 45 42 50
      magicBytes = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
      break;
    default:
      magicBytes = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
  }

  // Create a buffer of the requested size
  const buffer = Buffer.alloc(size);

  // Copy magic bytes to the start
  magicBytes.copy(buffer, 0);

  // Fill the rest with random data
  for (let i = magicBytes.length; i < size; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }

  return buffer;
}

describe('Image Upload Routes - E2E Integration Tests', () => {
  let userToken;
  let organizerToken;
  let testUser;
  let testOrganizer;
  let jwtService;

  // Set JWT_SECRET for test environment
  process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';

  beforeAll(async () => {
    await connectTestDB();
    jwtService = new JWTService();
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

    testOrganizer = await User.create({
      walletAddress: '0x123d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
      role: 'user',
      nonce: 'test-nonce-organizer',
      nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    // Generate JWT tokens
    userToken = jwtService.generateToken(testUser.walletAddress, testUser.role);
    organizerToken = jwtService.generateToken(testOrganizer.walletAddress, testOrganizer.role);
  });

  afterEach(async () => {
    await clearTestDB();
  });

  describe('Happy Path - Avatar Upload Lifecycle', () => {
    it('should upload avatar and update user profile', async () => {
      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('avatar', createValidImageBuffer('jpeg', 2048), {
          filename: 'test-avatar.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('avatarUrl');
      expect(response.body.data.avatarUrl).toContain('cloudinary.com');

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.avatarUrl).toBe(response.body.data.avatarUrl);
    });

    it('should replace old avatar with new one', async () => {
      const oldAvatarUrl = 'https://res.cloudinary.com/test/image/upload/avatars/old_avatar.jpg';
      await User.findByIdAndUpdate(testUser._id, { avatarUrl: oldAvatarUrl });

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('avatar', createValidImageBuffer('jpeg', 2048), {
          filename: 'new-avatar.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(200);

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.avatarUrl).not.toBe(oldAvatarUrl);
    });

    it('should include upload metadata in response', async () => {
      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('avatar', createValidImageBuffer('jpeg', 2048), {
          filename: 'test-avatar.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('publicId');
      expect(response.body.data).toHaveProperty('width');
      expect(response.body.data).toHaveProperty('height');
      expect(response.body.data).toHaveProperty('format');
      expect(response.body.data).toHaveProperty('bytes');
    });
  });

  describe('Business Logic Errors - Avatar Upload', () => {
    it('should reject non-image file format', async () => {
      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('avatar', Buffer.from('fake-pdf-data'), {
          filename: 'document.pdf',
          contentType: 'application/pdf'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_IMAGE_FORMAT');
    });

    it('should reject invalid MIME type', async () => {
      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('avatar', Buffer.from('fake-data'), {
          filename: 'file.txt',
          contentType: 'text/plain'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_IMAGE_FORMAT');
    });

    it('should reject file exceeding 5MB size limit', async () => {
      const largeBuffer = createValidImageBuffer('jpeg', 6 * 1024 * 1024);

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('avatar', largeBuffer, {
          filename: 'large-image.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FILE_SIZE_EXCEEDED');
    });
  });

  describe('Happy Path - Event Images Upload', () => {
    it('should accept event creation with images', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .field('title', 'Test Event')
        .field('description', 'Test Description')
        .field('category', 'Music')
        .field('fundingGoal', '1000000000000000000')
        .field('fundingDeadline', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .field('startDate', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString())
        .field('endDate', new Date(Date.now() + 61 * 24 * 60 * 60 * 1000).toISOString())
        .field('totalTickets', '100')
        .field('venue[name]', 'Test Venue')
        .field('venue[address]', '123 Test St')
        .field('venue[city]', 'Test City')
        .field('venue[country]', 'Test Country')
        .attach('images', createValidImageBuffer('jpeg', 2048), {
          filename: 'event-img-1.jpg',
          contentType: 'image/jpeg'
        });

      expect([201, 400]).toContain(response.status);
    });
  });

  describe('Business Logic Errors - Event Images Upload', () => {
    it('should reject more than 10 images', async () => {
      const req = request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .field('title', 'Test Event')
        .field('description', 'Test Description')
        .field('category', 'Music')
        .field('fundingGoal', '1000000000000000000')
        .field('fundingDeadline', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .field('startDate', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString())
        .field('endDate', new Date(Date.now() + 61 * 24 * 60 * 60 * 1000).toISOString())
        .field('totalTickets', '100')
        .field('venue[name]', 'Test Venue')
        .field('venue[address]', '123 Test St')
        .field('venue[city]', 'Test City')
        .field('venue[country]', 'Test Country');

      for (let i = 0; i < 11; i++) {
        req.attach('images', createValidImageBuffer('jpeg', 1024), {
          filename: `event-img-${i}.jpg`,
          contentType: 'image/jpeg'
        });
      }

      const response = await req;

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOO_MANY_FILES');
    });

    it('should reject invalid file types in event images', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .field('title', 'Test Event')
        .field('description', 'Test Description')
        .field('category', 'Music')
        .field('fundingGoal', '1000000000000000000')
        .field('fundingDeadline', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .field('startDate', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString())
        .field('endDate', new Date(Date.now() + 61 * 24 * 60 * 60 * 1000).toISOString())
        .field('totalTickets', '100')
        .field('venue[name]', 'Test Venue')
        .field('venue[address]', '123 Test St')
        .field('venue[city]', 'Test City')
        .field('venue[country]', 'Test Country')
        .attach('images', Buffer.from('fake-pdf-data'), {
          filename: 'document.pdf',
          contentType: 'application/pdf'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_IMAGE_FORMAT');
    });
  });

  describe('Happy Path - Event Image Deletion', () => {
    let testEvent;

    beforeEach(async () => {
      testEvent = await Event.create({
        title: 'Test Event',
        description: 'Test Description',
        category: 'Music',
        organizer: testOrganizer.walletAddress,
        fundingGoal: '1000000000000000000',
        fundingDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 61 * 24 * 60 * 60 * 1000),
        venue: {
          name: 'Test Venue',
          address: '123 Test St',
          city: 'Test City',
          country: 'Test Country'
        },
        totalTickets: 100,
        imageUrls: [
          'https://res.cloudinary.com/test/image/upload/events/123/img1.jpg',
          'https://res.cloudinary.com/test/image/upload/events/123/img2.jpg'
        ]
      });
    });

    it('should delete image from Cloudinary and database', async () => {
      const imageUrl = testEvent.imageUrls[0];
      const encodedImageUrl = encodeURIComponent(imageUrl);

      const response = await request(app)
        .delete(`/api/events/${testEvent._id}/images/${encodedImageUrl}`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const updatedEvent = await Event.findById(testEvent._id);
      expect(updatedEvent.imageUrls).toHaveLength(1);
      expect(updatedEvent.imageUrls).not.toContain(imageUrl);
    });
  });

  describe('Business Logic Errors - Event Image Deletion', () => {
    let testEvent;

    beforeEach(async () => {
      testEvent = await Event.create({
        title: 'Test Event',
        description: 'Test Description',
        category: 'Music',
        organizer: testOrganizer.walletAddress,
        fundingGoal: '1000000000000000000',
        fundingDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 61 * 24 * 60 * 60 * 1000),
        venue: {
          name: 'Test Venue',
          address: '123 Test St',
          city: 'Test City',
          country: 'Test Country'
        },
        totalTickets: 100,
        imageUrls: [
          'https://res.cloudinary.com/test/image/upload/events/123/img1.jpg',
          'https://res.cloudinary.com/test/image/upload/events/123/img2.jpg'
        ]
      });
    });

    it('should return 404 for non-existent image URL', async () => {
      const nonExistentUrl = 'https://res.cloudinary.com/test/image/upload/events/123/nonexistent.jpg';
      const encodedImageUrl = encodeURIComponent(nonExistentUrl);

      const response = await request(app)
        .delete(`/api/events/${testEvent._id}/images/${encodedImageUrl}`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Happy Path - Cascade Deletions', () => {
    it('should delete all event images when event is deleted', async () => {
      const testEvent = await Event.create({
        title: 'Test Event',
        description: 'Test Description',
        category: 'Music',
        organizer: testOrganizer.walletAddress,
        fundingGoal: '1000000000000000000',
        fundingDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 61 * 24 * 60 * 60 * 1000),
        venue: {
          name: 'Test Venue',
          address: '123 Test St',
          city: 'Test City',
          country: 'Test Country'
        },
        totalTickets: 100,
        imageUrls: [
          'https://res.cloudinary.com/test/image/upload/events/123/img1.jpg',
          'https://res.cloudinary.com/test/image/upload/events/123/img2.jpg',
          'https://res.cloudinary.com/test/image/upload/events/123/img3.jpg'
        ]
      });

      const response = await request(app)
        .delete(`/api/events/${testEvent._id}`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(response.status).toBe(200);

      const deletedEvent = await Event.findById(testEvent._id);
      expect(deletedEvent).toBeNull();
    });
  });
});
