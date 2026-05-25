import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../app.js';
import User from '../../../models/User.model.js';
import JWTService from '../../../services/auth/jwt.service.js';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../../helpers/db.helper.js';

const jwtService = new JWTService();

const testWallet = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
const smartAccount = '0x1234567890123456789012345678901234567890';

function makeIdToken(payload = {}) {
  return jwt.sign(
    {
      iss: 'https://api.openlogin.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payload,
    },
    'test-id-token-secret',
  );
}

describe('Auth Routes - E2E Integration Tests', () => {
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

  describe('POST /api/auth/login', () => {
    it('logs in an external wallet user from a Web3Auth idToken', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          idToken: makeIdToken({
            wallets: [{ type: 'ethereum', address: testWallet }],
          }),
          walletAddress: testWallet,
          smartAccountAddress: smartAccount,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.walletAddress).toBe(testWallet.toLowerCase());
      expect(response.body.data.user.username).toBe('user_742d35');

      const user = await User.findOne({ walletAddress: testWallet.toLowerCase() });
      expect(user).toBeDefined();
      expect(user.role).toBe('user');
      expect(user.smartAccountAddress).toBe(smartAccount.toLowerCase());

      const decoded = jwt.decode(response.body.data.token);
      expect(decoded.walletAddress).toBe(testWallet.toLowerCase());
      expect(decoded.role).toBe('user');
    });

    it('logs in a social user and stores profile fields from the idToken', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          idToken: makeIdToken({
            email: 'Alice@example.com',
            name: 'Alice Nguyen',
            picture: 'https://example.com/avatar.png',
          }),
          walletAddress: testWallet,
          smartAccountAddress: smartAccount,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('alice@example.com');
      expect(response.body.data.user.username).toBe('Alice Nguyen');

      const user = await User.findOne({ email: 'alice@example.com' });
      expect(user.walletAddress).toBe(testWallet.toLowerCase());
      expect(user.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('updates an existing external wallet smart account address', async () => {
      await User.create({
        walletAddress: testWallet,
        role: 'user',
        username: 'existing_user',
        nonce: 'external_wallet',
        nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          idToken: makeIdToken({ wallets: [{ type: 'ethereum' }] }),
          walletAddress: testWallet,
          smartAccountAddress: smartAccount,
        });

      expect(response.status).toBe(200);
      const user = await User.findOne({ walletAddress: testWallet.toLowerCase() });
      expect(user.username).toBe('existing_user');
      expect(user.smartAccountAddress).toBe(smartAccount.toLowerCase());
    });

    it('returns 400 when idToken is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ walletAddress: testWallet });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ID_TOKEN_REQUIRED');
    });

    it('returns 400 when walletAddress is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ idToken: makeIdToken() });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('WALLET_ADDRESS_REQUIRED');
    });

    it('returns 400 for a malformed idToken', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ idToken: 'not-a-jwt', walletAddress: testWallet });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    let userToken;

    beforeEach(async () => {
      const user = await User.create({
        walletAddress: testWallet,
        role: 'user',
        nonce: 'test-nonce',
        nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
      userToken = jwtService.generateToken(user.walletAddress, user.role);
    });

    it('logs out an authenticated user', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logged out successfully');
    });

    it('returns 401 for unauthenticated requests', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let userToken;

    beforeEach(async () => {
      const user = await User.create({
        walletAddress: testWallet,
        role: 'user',
        nonce: 'test-nonce',
        nonceExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
      userToken = jwtService.generateToken(user.walletAddress, user.role);
    });

    it('refreshes a valid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ token: userToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');

      const decoded = jwt.decode(response.body.data.token);
      expect(decoded.walletAddress).toBe(testWallet.toLowerCase());
      expect(decoded.role).toBe('user');
    });

    it('returns 400 when token body is missing', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ token: userToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
