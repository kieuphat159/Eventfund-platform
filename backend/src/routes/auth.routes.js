import express from 'express';
import AuthController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authSchemas } from '../validators/auth.validator.js';

const router = express.Router();
const controller = new AuthController();

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
router.post('/nonce', validate({ body: authSchemas.nonce }), (req, res, next) => controller.getNonce(req, res, next));

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
router.post('/message', validate({ body: authSchemas.message }), (req, res, next) => controller.getMessage(req, res, next));

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
router.post('/verify', validate({ body: authSchemas.verify }), (req, res, next) => controller.verifySignature(req, res, next));

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
router.post('/logout', authenticate, (req, res, next) => controller.logout(req, res, next));

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
router.post('/refresh', authenticate, (req, res, next) => controller.refreshToken(req, res, next));

export default router;
