import express from 'express';
import UsersController from '../controllers/users.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { userSchemas } from '../validators/user.validator.js';

const router = express.Router();
const controller = new UsersController();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile and portfolio endpoints
 */

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
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
 *                     walletAddress:
 *                       type: string
 *                       example: "0x742d35cc6634c0532925a3b844bc9e7595f0beb"
 *                     username:
 *                       type: string
 *                       example: "john_doe"
 *                     email:
 *                       type: string
 *                       example: "john@example.com"
 *                     avatarUrl:
 *                       type: string
 *                       example: "https://example.com/avatar.jpg"
 *                     role:
 *                       type: string
 *                       enum: [user, organizer, verifier, admin]
 *                       example: "user"
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/profile', authenticate, (req, res, next) => controller.getProfile(req, res, next));

/**
 * @swagger
 * /users/profile:
 *   patch:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 example: "john_doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *                 example: "https://example.com/avatar.jpg"
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                     walletAddress:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     avatarUrl:
 *                       type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.patch('/profile', authenticate, validate({ body: userSchemas.updateProfile }), (req, res, next) => controller.updateProfile(req, res, next));

/**
 * @swagger
 * /users/portfolio:
 *   get:
 *     summary: Get user portfolio (tickets, shares, rewards)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User portfolio
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
 *                     tickets:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           description: Total number of tickets owned
 *                         byStatus:
 *                           type: object
 *                           properties:
 *                             sold:
 *                               type: integer
 *                             used:
 *                               type: integer
 *                             expired:
 *                               type: integer
 *                     shares:
 *                       type: object
 *                       properties:
 *                         totalEvents:
 *                           type: integer
 *                           description: Number of events with shares
 *                         totalContribution:
 *                           type: string
 *                           description: Total contribution amount (BigInt string)
 *                         totalSharePercentage:
 *                           type: number
 *                           description: Sum of share percentages across all events
 *                     rewards:
 *                       type: object
 *                       properties:
 *                         claimed:
 *                           type: string
 *                           description: Total claimed rewards (BigInt string)
 *                         pending:
 *                           type: string
 *                           description: Total pending rewards (BigInt string)
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/portfolio', authenticate, (req, res, next) => controller.getUserPortfolio(req, res, next));

/**
 * @swagger
 * /users/shares:
 *   get:
 *     summary: Get user shares across all events
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User shares
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       eventId:
 *                         type: string
 *                       eventTitle:
 *                         type: string
 *                       contributionAmount:
 *                         type: string
 *                         description: Contribution amount (BigInt string)
 *                       sharePercentage:
 *                         type: number
 *                       claimedReward:
 *                         type: string
 *                         description: Claimed reward (BigInt string)
 *                       pendingReward:
 *                         type: string
 *                         description: Pending reward (BigInt string)
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/shares', authenticate, (req, res, next) => controller.getUserShares(req, res, next));

/**
 * @swagger
 * /users/rewards:
 *   get:
 *     summary: Get user rewards (claimed and pending)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User rewards
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
 *                     claimed:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           eventId:
 *                             type: string
 *                           eventTitle:
 *                             type: string
 *                           rewardAmount:
 *                             type: string
 *                             description: Reward amount (BigInt string)
 *                           claimedAt:
 *                             type: string
 *                             format: date-time
 *                           txHash:
 *                             type: string
 *                     pending:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           eventId:
 *                             type: string
 *                           eventTitle:
 *                             type: string
 *                           rewardAmount:
 *                             type: string
 *                             description: Reward amount (BigInt string)
 *                           sharePercentage:
 *                             type: number
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/rewards', authenticate, (req, res, next) => controller.getUserRewards(req, res, next));

export default router;
