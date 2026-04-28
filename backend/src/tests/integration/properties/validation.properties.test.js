/**
 * Property-based integration tests for request validation behavior.
 *
 * This suite intentionally focuses on stable, API-facing contracts:
 * - malformed payload/query should return a validation error shape
 * - auth middleware should short-circuit protected routes before validation
 * - unknown query fields should not crash validation middleware
 */

import fc from 'fast-check';
import request from 'supertest';
import app from '../../../app.js';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../../helpers/db.helper.js';

const HEX_CHARS = '0123456789abcdef'.split('');

const fixedHex = (len) =>
  fc
    .array(fc.constantFrom(...HEX_CHARS), { minLength: len, maxLength: len })
    .map((chars) => chars.join(''));

const walletAddressArb = fixedHex(40).map((h) => `0x${h}`);
const signatureArb = fixedHex(130).map((h) => `0x${h}`);

const invalidWalletArb = fc.oneof(
  fc.constant(''),
  fc.constant('invalid'),
  fc.string({ minLength: 1, maxLength: 39 }).map((s) => `0x${s}`),
  fc.string({ minLength: 41, maxLength: 80 }).map((s) => `0x${s}`),
  fc.string({ minLength: 40, maxLength: 40 }),
  fc.constant(`0x${'Z'.repeat(40)}`)
);

const invalidSignatureArb = fc.oneof(
  fc.constant(''),
  fc.constant('invalid'),
  fc.string({ minLength: 1, maxLength: 129 }).map((s) => `0x${s}`),
  fc.string({ minLength: 131, maxLength: 200 }).map((s) => `0x${s}`),
  fc.string({ minLength: 130, maxLength: 130 }),
  fc.constant(`0x${'Z'.repeat(130)}`)
);

const assertValidationErrorShape = (response) => {
  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('success', false);
  expect(response.body).toHaveProperty('error');

  const { error } = response.body;
  expect(error).toHaveProperty('code', 'VALIDATION_ERROR');
  expect(error).toHaveProperty('message');
  expect(typeof error.message).toBe('string');
  expect(error.message.length).toBeGreaterThan(0);
  expect(Array.isArray(error.details)).toBe(true);
  expect(error.details.length).toBeGreaterThan(0);

  error.details.forEach((detail) => {
    expect(detail).toHaveProperty('field');
    expect(detail).toHaveProperty('message');
    expect(detail).toHaveProperty('type');
    expect(typeof detail.field).toBe('string');
    expect(typeof detail.message).toBe('string');
    expect(typeof detail.type).toBe('string');
  });
};

describe('Validation Properties - Integration', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  describe('Property 1: Invalid input returns validation error shape', () => {
    it('POST /api/auth/nonce validates wallet address format', async () => {
      await fc.assert(
        fc.asyncProperty(invalidWalletArb, async (walletAddress) => {
          const response = await request(app).post('/api/auth/nonce').send({ walletAddress });
          assertValidationErrorShape(response);
        }),
        { numRuns: 80 }
      );
    });

    it('POST /api/auth/verify validates signature format', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1, maxLength: 180 }), invalidSignatureArb, async (message, signature) => {
          const response = await request(app).post('/api/auth/verify').send({ message, signature });
          assertValidationErrorShape(response);
        }),
        { numRuns: 80 }
      );
    });

    it('GET /api/events validates invalid query parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record(
            {
              page: fc.oneof(fc.constant(0), fc.integer({ max: -1 }), fc.string({ minLength: 1, maxLength: 4 })),
              limit: fc.oneof(fc.constant(0), fc.integer({ min: 101, max: 999 }), fc.string({ minLength: 1, maxLength: 4 })),
              status: fc.oneof(fc.constant('INVALID_STATUS'), fc.integer())
            },
            { requiredKeys: [] }
          ),
          async (query) => {
            const response = await request(app).get('/api/events').query(query);
            if (response.status === 400) {
              assertValidationErrorShape(response);
            } else {
              expect([200]).toContain(response.status);
            }
          }
        ),
        { numRuns: 60 }
      );
    });

    it('GET /api/tickets validates invalid query parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record(
            {
              status: fc.oneof(fc.constant('BAD_STATUS'), fc.integer()),
              page: fc.oneof(fc.constant(0), fc.integer({ max: -1 }), fc.string({ minLength: 1, maxLength: 4 })),
              limit: fc.oneof(fc.constant(0), fc.integer({ min: 101, max: 999 }), fc.string({ minLength: 1, maxLength: 4 }))
            },
            { requiredKeys: [] }
          ),
          async (query) => {
            const response = await request(app).get('/api/tickets').query(query);
            if (response.status === 400) {
              assertValidationErrorShape(response);
            } else {
              expect([200]).toContain(response.status);
            }
          }
        ),
        { numRuns: 60 }
      );
    });

    it('GET /api/marketplace/listings validates invalid query parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record(
            {
              minPrice: fc.oneof(fc.constant('-1'), fc.constant('abc'), fc.integer({ max: -1 })),
              maxPrice: fc.oneof(fc.constant('-5'), fc.constant('xyz'), fc.integer({ max: -1 })),
              page: fc.oneof(fc.constant(0), fc.integer({ max: -1 }), fc.string({ minLength: 1, maxLength: 4 })),
              limit: fc.oneof(fc.constant(0), fc.integer({ min: 101, max: 999 }), fc.string({ minLength: 1, maxLength: 4 }))
            },
            { requiredKeys: [] }
          ),
          async (query) => {
            const response = await request(app).get('/api/marketplace/listings').query(query);
            if (response.status === 400) {
              assertValidationErrorShape(response);
            } else {
              expect([200]).toContain(response.status);
            }
          }
        ),
        { numRuns: 60 }
      );
    });
  });

  describe('Property 2: Auth short-circuit before validation', () => {
    it('POST /api/events returns auth error for unauthenticated request with invalid body', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            title: fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 2 })),
            fundingGoal: fc.oneof(fc.constant('abc'), fc.constant('-10'))
          }),
          async (body) => {
            const response = await request(app).post('/api/events').send(body);
            expect([401, 403]).toContain(response.status);
            if (response.body?.error?.code) {
              expect(response.body.error.code).not.toBe('VALIDATION_ERROR');
            }
          }
        ),
        { numRuns: 40 }
      );
    });

    it('POST /api/tickets/verify returns auth error for unauthenticated request', async () => {
      await fc.assert(
        fc.asyncProperty(walletAddressArb, async (walletAddress) => {
          const response = await request(app)
            .post('/api/tickets/verify')
            .send({ tokenId: 1, walletAddress, eventId: '507f1f77bcf86cd799439011' });

          expect([401, 403]).toContain(response.status);
          if (response.body?.error?.code) {
            expect(response.body.error.code).not.toBe('VALIDATION_ERROR');
          }
        }),
        { numRuns: 40 }
      );
    });
  });

  describe('Property 3: Valid format should not produce validation errors', () => {
    it('POST /api/auth/nonce accepts structurally valid wallet format', async () => {
      await fc.assert(
        fc.asyncProperty(walletAddressArb, async (walletAddress) => {
          const response = await request(app).post('/api/auth/nonce').send({ walletAddress });
          expect(response.status).not.toBe(400);
          if (response.body?.error?.code) {
            expect(response.body.error.code).not.toBe('VALIDATION_ERROR');
          }
        }),
        { numRuns: 50 }
      );
    });

    it('POST /api/auth/verify with valid formats does not fail at format validator', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1, maxLength: 180 }), signatureArb, async (message, signature) => {
          const response = await request(app).post('/api/auth/verify').send({ message, signature });
          if (response.status === 400) {
            expect(response.body?.error?.code).not.toBe('VALIDATION_ERROR');
          }
        }),
        { numRuns: 40 }
      );
    });
  });
});
