import express from 'express';
import AuthController from '../controllers/auth.controller.js';
import AuthService from '../services/auth/auth.service.js';
import NonceService from '../services/auth/nonce.service.js';
import SIWEService from '../services/auth/siwe.service.js';
import JWTService from '../services/auth/jwt.service.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authSchemas } from '../validators/auth.validator.js';
import config from '../config/env.js';

const router = express.Router();

// Dependency Injection: Create services and inject into controller
const nonceService = new NonceService();
const siweService = new SIWEService();
const jwtService = new JWTService(config.jwt.secret);
const authService = new AuthService(nonceService, siweService, jwtService);
const controller = new AuthController(authService);

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: SIWE authentication endpoints
 */

/**
 * @swagger
 * /auth/nonce:
 *   post:
 *     summary: Generate nonce for SIWE authentication
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
 *     responses:
 *       200:
 *         description: Nonce generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     nonce:
 *                       type: string
 *                       example: 'a3f5e8d2c1b4a6f9e7d3c2b1a5f8e6d4'
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid wallet address
 */
// POST /api/auth/login — Web3Auth social login (idToken from Web3Auth Modal)
router.post('/login', controller.login);

router.post('/nonce', validate({ body: authSchemas.nonce }), controller.getNonce);

/**
 * @swagger
 * /auth/message:
 *   post:
 *     summary: Create SIWE message for signing
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'
 *               chainId:
 *                 type: number
 *                 example: 1
 *                 description: Optional chain ID (defaults to config)
 *     responses:
 *       200:
 *         description: SIWE message created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       description: SIWE formatted message ready for signing
 *                     nonce:
 *                       type: string
 *                       example: 'a3f5e8d2c1b4a6f9e7d3c2b1a5f8e6d4'
 *       400:
 *         description: Invalid wallet address or no nonce found
 */
router.post('/message', validate({ body: authSchemas.message }), controller.getMessage);

/**
 * @swagger
 * /auth/verify:
 *   post:
 *     summary: Verify SIWE signature and get JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - signature
 *             properties:
 *               message:
 *                 type: string
 *                 description: SIWE message string
 *               signature:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{130}$'
 *                 description: Ethereum signature
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: JWT token
 *                     user:
 *                       type: object
 *                       properties:
 *                         walletAddress:
 *                           type: string
 *                         role:
 *                           type: string
 *                           enum: [user, organizer, verifier, admin]
 *       401:
 *         description: Invalid signature or expired nonce
 */
router.post('/verify', validate({ body: authSchemas.verify }), controller.verifySignature);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Not authenticated
 */
router.post('/logout', authenticate, controller.logout);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *       401:
 *         description: Not authenticated
 */
router.post('/refresh', authenticate, controller.refreshToken);

export default router;
