/**
 * E2E Integration Tests for Auth Routes
 * Focus: Happy Path & Business Logic Errors
 *
 * Test Strategy:
 * - Happy Path: Verify complete authentication flow with valid data
 * - Business Logic Errors: Test domain-specific error conditions
 * - SIWE Authentication: Test Sign-In with Ethereum flow
 *
 * Requirements: 1.3, 8.1-8.5
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import app from '../../../app.js';
import User from '../../../models/User.model.js';
import JWTService from '../../../services/auth/jwt.service.js';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../../helpers/db.helper.js';

// Set JWT_SECRET explicitly for test environment to avoid dependency on .env
process.env.JWT_SECRET = 'test-secret-key-for-integration-tests-do-not-use-in-production';

const jwtService = new JWTService();

describe('Auth Routes - E2E Integration Tests', () => {
  const testWallet = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
  const testWallet2 = '0x1234567890123456789012345678901234567890';

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

  describe('POST /api/auth/nonce - Generate Nonce', () => {
    describe('Happy Path', () => {
      it('should generate nonce for new wallet address', async () => {
        const response = await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress: testWallet });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('nonce');
        expect(response.body.data).toHaveProperty('expiresAt');
        expect(typeof response.body.data.nonce).toBe('string');
        expect(response.body.data.nonce.length).toBeGreaterThan(0);

        // Verify user created in database
        const user = await User.findOne({ walletAddress: testWallet.toLowerCase() });
        expect(user).toBeDefined();
        expect(user.nonce).toBe(response.body.data.nonce);
        expect(user.role).toBe('user');
      });

      it('should generate new nonce for existing user', async () => {
        // Create existing user
        await User.create({
          walletAddress: testWallet,
          role: 'user',
          nonce: 'old-nonce',
          nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
        });

        const response = await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress: testWallet });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.nonce).not.toBe('old-nonce');

        // Verify nonce updated in database
        const user = await User.findOne({ walletAddress: testWallet.toLowerCase() });
        expect(user.nonce).toBe(response.body.data.nonce);
      });

      it('should handle mixed-case wallet addresses', async () => {
        // Mixed case (checksum format) should be accepted
        const mixedCaseWallet = '0x742D35Cc6634C0532925a3b844Bc9e7595f0bEb0';

        const response = await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress: mixedCaseWallet });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // Verify stored as lowercase
        const user = await User.findOne({ walletAddress: testWallet.toLowerCase() });
        expect(user).toBeDefined();
      });
    });

    describe('Business Logic Errors', () => {
      it('should return 400 for missing wallet address', async () => {
        const response = await request(app)
          .post('/api/auth/nonce')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for invalid wallet address format', async () => {
        const response = await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress: 'invalid-address' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 for wallet address without 0x prefix', async () => {
        const response = await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress: '742d35Cc6634C0532925a3b844Bc9e7595f0bEb0' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('POST /api/auth/message - Create SIWE Message', () => {
    describe('Happy Path', () => {
      it('should create SIWE message for wallet with existing nonce', async () => {
        // First generate nonce
        await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress: testWallet });

        // Then get SIWE message
        const response = await request(app)
          .post('/api/auth/message')
          .send({ walletAddress: testWallet });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('message');
        expect(response.body.data).toHaveProperty('nonce');
        expect(typeof response.body.data.message).toBe('string');
        // SIWE message contains checksum address (mixed case), so check case-insensitive
        expect(response.body.data.message.toLowerCase()).toContain(testWallet.toLowerCase());
        expect(response.body.data.message).toContain('wants you to sign in');
      });

      it('should create SIWE message with custom chainId', async () => {
        await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress: testWallet });

        const response = await request(app)
          .post('/api/auth/message')
          .send({
            walletAddress: testWallet,
            chainId: 137 // Polygon
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toContain('Chain ID: 137');
      });
    });

    describe('Business Logic Errors', () => {
      it('should return 400 when nonce does not exist', async () => {
        const response = await request(app)
          .post('/api/auth/message')
          .send({ walletAddress: testWallet });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('No nonce found');
        expect(response.body.error.code).toBe('NONCE_NOT_FOUND');
      });

      it('should return 400 for missing wallet address', async () => {
        const response = await request(app)
          .post('/api/auth/message')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 for invalid wallet address', async () => {
        const response = await request(app)
          .post('/api/auth/message')
          .send({ walletAddress: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('POST /api/auth/verify - Verify Signature', () => {
    describe('Happy Path', () => {
      it('should successfully verify valid signature and return JWT token', async () => {
        // Create a real wallet in memory
        const wallet = ethers.Wallet.createRandom();
        const walletAddress = wallet.address;

        // Step 1: Generate nonce
        const nonceResponse = await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress });

        expect(nonceResponse.status).toBe(200);
        const { nonce } = nonceResponse.body.data;

        // Step 2: Get SIWE message
        const messageResponse = await request(app)
          .post('/api/auth/message')
          .send({ walletAddress });

        expect(messageResponse.status).toBe(200);
        const { message } = messageResponse.body.data;

        // Step 3: Sign message with wallet's private key
        const signature = await wallet.signMessage(message);

        // Step 4: Verify signature and get JWT token
        const verifyResponse = await request(app)
          .post('/api/auth/verify')
          .send({ message, signature });

        expect(verifyResponse.status).toBe(200);
        expect(verifyResponse.body.success).toBe(true);
        expect(verifyResponse.body.data).toHaveProperty('token');
        expect(verifyResponse.body.data).toHaveProperty('user');

        // Verify token structure
        expect(typeof verifyResponse.body.data.token).toBe('string');
        expect(verifyResponse.body.data.token.length).toBeGreaterThan(0);

        // Verify user data
        expect(verifyResponse.body.data.user.walletAddress).toBe(walletAddress.toLowerCase());
        expect(verifyResponse.body.data.user.role).toBe('user');

        // Verify JWT token is valid
        const decoded = jwt.decode(verifyResponse.body.data.token);
        expect(decoded.walletAddress).toBe(walletAddress.toLowerCase());
        expect(decoded.role).toBe('user');
      });
    });

    describe('Business Logic Errors', () => {
      it('should return 400 for missing message', async () => {
        const response = await request(app)
          .post('/api/auth/verify')
          .send({
            signature: '0x' + 'a'.repeat(130)
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for missing signature', async () => {
        const response = await request(app)
          .post('/api/auth/verify')
          .send({
            message: 'test message'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for invalid signature format', async () => {
        const response = await request(app)
          .post('/api/auth/verify')
          .send({
            message: 'test message',
            signature: 'invalid-signature'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 for invalid SIWE message format', async () => {
        const response = await request(app)
          .post('/api/auth/verify')
          .send({
            message: 'not a valid SIWE message',
            signature: '0x' + 'a'.repeat(130)
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        // SIWE parser returns detailed error message, just check it's an error
        expect(response.body.error.message).toBeDefined();
        expect(response.body.error.message.length).toBeGreaterThan(0);
      });

      it('should return 400 for empty message', async () => {
        const response = await request(app)
          .post('/api/auth/verify')
          .send({
            message: '',
            signature: '0x' + 'a'.repeat(130)
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 for signature with invalid length', async () => {
        const response = await request(app)
          .post('/api/auth/verify')
          .send({
            message: 'test message',
            signature: '0x123'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 401 for valid signature format but signed by different wallet', async () => {
        // Create wallet A
        const walletA = ethers.Wallet.createRandom();

        // Step 1: Generate nonce for wallet A
        const nonceResponse = await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress: walletA.address });

        expect(nonceResponse.status).toBe(200);

        // Step 2: Get SIWE message for wallet A
        const messageResponse = await request(app)
          .post('/api/auth/message')
          .send({ walletAddress: walletA.address });

        expect(messageResponse.status).toBe(200);
        const { message } = messageResponse.body.data;

        // Step 3: Sign with wallet B (different wallet)
        const walletB = ethers.Wallet.createRandom();
        const signature = await walletB.signMessage(message);

        // Step 4: Try to verify - should fail
        const verifyResponse = await request(app)
          .post('/api/auth/verify')
          .send({ message, signature });

        expect(verifyResponse.status).toBe(401);
        expect(verifyResponse.body.success).toBe(false);
        // Verify the error is specifically about signature/address mismatch
        const errorMsg = verifyResponse.body.error.message.toLowerCase();
        expect(
          errorMsg.includes('signature') ||
          errorMsg.includes('address') ||
          errorMsg.includes('invalid')
        ).toBe(true);
      });

      it('should return 401 for expired nonce', async () => {
        const wallet = ethers.Wallet.createRandom();

        // Generate a proper nonce (hex format like the real service does)
        const crypto = await import('crypto');
        const expiredNonce = crypto.randomBytes(32).toString('hex');

        // Create user with expired nonce
        await User.create({
          walletAddress: wallet.address,
          role: 'user',
          nonce: expiredNonce,
          nonceExpiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
        });

        // Manually create SIWE message with expired nonce
        const siweService = new (await import('../../../services/auth/siwe.service.js')).default();
        const message = siweService.createSIWEMessage(
          wallet.address,
          expiredNonce,
          'localhost:4000',
          'http://localhost:4000',
          1
        );

        // Sign message
        const signature = await wallet.signMessage(message);

        // Try to verify with expired nonce
        const verifyResponse = await request(app)
          .post('/api/auth/verify')
          .send({ message, signature });

        expect(verifyResponse.status).toBe(401);
        expect(verifyResponse.body.success).toBe(false);
        expect(verifyResponse.body.error.message.toLowerCase()).toContain('expired');
      });

      it('should prevent replay attack - nonce cannot be reused', async () => {
        const wallet = ethers.Wallet.createRandom();

        // Step 1: Generate nonce
        await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress: wallet.address });

        // Step 2: Get SIWE message
        const messageResponse = await request(app)
          .post('/api/auth/message')
          .send({ walletAddress: wallet.address });

        const { message, nonce: originalNonce } = messageResponse.body.data;

        // Step 3: Sign message
        const signature = await wallet.signMessage(message);

        // Step 4: First verification - should succeed
        const firstVerify = await request(app)
          .post('/api/auth/verify')
          .send({ message, signature });

        expect(firstVerify.status).toBe(200);
        expect(firstVerify.body.success).toBe(true);

        // Verify nonce has been invalidated in database
        const userAfterVerify = await User.findOne({ walletAddress: wallet.address.toLowerCase() });
        expect(userAfterVerify).toBeDefined();
        expect(userAfterVerify.nonce).not.toBe(originalNonce); // Nonce should be changed

        // Step 5: Try to reuse same message + signature (replay attack)
        const replayVerify = await request(app)
          .post('/api/auth/verify')
          .send({ message, signature });

        expect(replayVerify.status).toBe(401);
        expect(replayVerify.body.success).toBe(false);
      });

      it('should return 401 for phishing attack - domain mismatch', async () => {
        const wallet = ethers.Wallet.createRandom();

        // Step 1: Generate nonce
        await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress: wallet.address });

        // Step 2: Get the nonce from database
        const user = await User.findOne({ walletAddress: wallet.address.toLowerCase() });
        const nonce = user.nonce;

        // Step 3: Create SIWE message with WRONG domain (phishing site)
        const siweService = new (await import('../../../services/auth/siwe.service.js')).default();
        const phishingMessage = siweService.createSIWEMessage(
          wallet.address,
          nonce,
          'evil-phishing-site.com', // Wrong domain!
          'http://evil-phishing-site.com',
          1
        );

        // Step 4: Sign the phishing message
        const signature = await wallet.signMessage(phishingMessage);

        // Step 5: Try to verify with wrong domain - should fail
        const verifyResponse = await request(app)
          .post('/api/auth/verify')
          .send({ message: phishingMessage, signature });

        expect(verifyResponse.status).toBe(401);
        expect(verifyResponse.body.success).toBe(false);
        // Verify the error is specifically about domain mismatch, not other errors
        expect(verifyResponse.body.error.message.toLowerCase()).toContain('domain');
      });
    });
  });

  describe('POST /api/auth/logout - Logout User', () => {
    let userToken;

    beforeEach(async () => {
      // Create user and generate token
      const user = await User.create({
        walletAddress: testWallet,
        role: 'user',
        nonce: 'test-nonce',
        nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
      });
      userToken = jwtService.generateToken(user.walletAddress, user.role);
    });

    describe('Happy Path', () => {
      it('should successfully logout authenticated user', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('Logged out successfully');
      });
    });

    describe('Business Logic Errors', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await request(app)
          .post('/api/auth/logout');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should return 401 for invalid token', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should return 401 for expired token', async () => {
        // Create token with exp claim set to past time (1 day ago)
        const pastTime = Math.floor(Date.now() / 1000) - 86400;
        const expiredToken = jwt.sign(
          {
            walletAddress: testWallet.toLowerCase(),
            role: 'user',
            exp: pastTime
          },
          jwtService.secret
        );

        const response = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message.toLowerCase()).toContain('expired');
      });
    });
  });

  describe('POST /api/auth/refresh - Refresh Token', () => {
    let userToken;

    beforeEach(async () => {
      const user = await User.create({
        walletAddress: testWallet,
        role: 'user',
        nonce: 'test-nonce',
        nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
      });
      userToken = jwtService.generateToken(user.walletAddress, user.role);
    });

    describe('Happy Path', () => {
      it('should successfully refresh valid token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ token: userToken });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('token');
        expect(typeof response.body.data.token).toBe('string');
        expect(response.body.data.token.length).toBeGreaterThan(0);

        // Verify new token is valid
        const decoded = jwt.decode(response.body.data.token);
        expect(decoded.walletAddress).toBe(testWallet.toLowerCase());
        expect(decoded.role).toBe('user');
      });
    });

    describe('Business Logic Errors', () => {
      it('should return 400 for missing token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .set('Authorization', `Bearer ${userToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('Token is required');
      });

      it('should return 401 for invalid token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ token: 'invalid-token' });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should return 401 for expired token', async () => {
        // Create token with exp claim set to past time (1 day ago)
        const pastTime = Math.floor(Date.now() / 1000) - 86400;
        const expiredToken = jwt.sign(
          {
            walletAddress: testWallet.toLowerCase(),
            role: 'user',
            exp: pastTime
          },
          jwtService.secret
        );

        const response = await request(app)
          .post('/api/auth/refresh')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ token: expiredToken });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message.toLowerCase()).toContain('expired');
      });

      it('should return 401 for unauthenticated request', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ token: userToken });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Complete Authentication Flow', () => {
    describe('Happy Path', () => {
      it('should complete full SIWE authentication flow from nonce to JWT token', async () => {
        // Create a real wallet
        const wallet = ethers.Wallet.createRandom();
        const walletAddress = wallet.address;

        // Step 1: Generate nonce
        const nonceResponse = await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress });

        expect(nonceResponse.status).toBe(200);
        expect(nonceResponse.body.success).toBe(true);
        const { nonce: originalNonce } = nonceResponse.body.data;

        // Step 2: Get SIWE message
        const messageResponse = await request(app)
          .post('/api/auth/message')
          .send({ walletAddress });

        expect(messageResponse.status).toBe(200);
        expect(messageResponse.body.data.nonce).toBe(originalNonce);
        const { message } = messageResponse.body.data;
        expect(messageResponse.body.data.message.toLowerCase()).toContain(walletAddress.toLowerCase());

        // Step 3: Sign message with wallet's private key
        const signature = await wallet.signMessage(message);
        expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);

        // Step 4: Verify signature and get JWT token
        const verifyResponse = await request(app)
          .post('/api/auth/verify')
          .send({ message, signature });

        expect(verifyResponse.status).toBe(200);
        expect(verifyResponse.body.success).toBe(true);
        expect(verifyResponse.body.data).toHaveProperty('token');
        expect(verifyResponse.body.data).toHaveProperty('user');

        const { token, user } = verifyResponse.body.data;

        // Verify JWT token
        expect(typeof token).toBe('string');
        const decoded = jwt.decode(token);
        expect(decoded.walletAddress).toBe(walletAddress.toLowerCase());
        expect(decoded.role).toBe('user');

        // Verify user data
        expect(user.walletAddress).toBe(walletAddress.toLowerCase());
        expect(user.role).toBe('user');

        // Verify user exists in database with correct data
        const dbUser = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
        expect(dbUser).toBeDefined();
        expect(dbUser.role).toBe('user');

        // Verify nonce has been invalidated after successful verification
        expect(dbUser.nonce).not.toBe(originalNonce);

        // Step 5: Use token to access protected endpoint (logout)
        const logoutResponse = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${token}`);

        expect(logoutResponse.status).toBe(200);
        expect(logoutResponse.body.success).toBe(true);
      });

      it('should handle multiple users independently with complete flow', async () => {
        // User 1
        const nonce1Response = await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress: testWallet });

        expect(nonce1Response.status).toBe(200);

        // User 2
        const nonce2Response = await request(app)
          .post('/api/auth/nonce')
          .send({ walletAddress: testWallet2 });

        expect(nonce2Response.status).toBe(200);

        // Verify different nonces
        expect(nonce1Response.body.data.nonce).not.toBe(nonce2Response.body.data.nonce);

        // Verify both users exist
        const user1 = await User.findOne({ walletAddress: testWallet.toLowerCase() });
        const user2 = await User.findOne({ walletAddress: testWallet2.toLowerCase() });
        expect(user1).toBeDefined();
        expect(user2).toBeDefined();
        expect(user1.nonce).not.toBe(user2.nonce);
      });
    });
  });
});
