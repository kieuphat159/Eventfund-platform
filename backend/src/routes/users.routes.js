import express from 'express';
import UsersController from '../controllers/users.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { userSchemas } from '../validators/user.validator.js';
import { uploadAvatar, validateSingleImage } from '../middlewares/image.middleware.js';

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
router.get('/profile', authenticate, controller.getProfile);

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
 *         multipart/form-data:
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
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image file (jpg, jpeg, png, gif, webp, max 5MB)
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
router.patch('/profile', authenticate, uploadAvatar, validateSingleImage, validate({ body: userSchemas.updateProfile }), controller.updateProfile);

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
 *                           description: Total contribution amount (string representation of wei amount)
 *                         totalSharePercentage:
 *                           type: number
 *                           description: Sum of share percentages across all events
 *                     rewards:
 *                       type: object
 *                       properties:
 *                         claimed:
 *                           type: string
 *                           description: Total claimed rewards (string representation of wei amount)
 *                         pending:
 *                           type: string
 *                           description: Total pending rewards (string representation of wei amount)
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/portfolio', authenticate, controller.getUserPortfolio);

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
 *                         description: Contribution amount (string representation of wei amount)
 *                       sharePercentage:
 *                         type: number
 *                       claimedReward:
 *                         type: string
 *                         description: Claimed reward (string representation of wei amount)
 *                       pendingReward:
 *                         type: string
 *                         description: Pending reward (string representation of wei amount)
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/shares', authenticate, controller.getUserShares);

/**
 * @swagger
 * /users/shares/{id}:
 *   get:
 *     summary: Get details for a single user investment share
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Share document ID
 *     responses:
 *       200:
 *         description: Share detail
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
 *                     _id:
 *                       type: string
 *                     eventId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         title:
 *                           type: string
 *                         status:
 *                           type: string
 *                         startDate:
 *                           type: string
 *                         endDate:
 *                           type: string
 *                     contributionAmount:
 *                       type: number
 *                     sharePercentage:
 *                       type: number
 *                     claimedReward:
 *                       type: number
 *                     pendingReward:
 *                       type: number
 *                     shareTokenId:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Investment not found
 *       500:
 *         description: Server error
 */
router.get('/shares/:id', authenticate, controller.getUserShareById);

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
 *                             description: Reward amount (string representation of wei amount)
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
 *                             description: Reward amount (string representation of wei amount)
 *                           sharePercentage:
 *                             type: number
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/rewards', authenticate, controller.getUserRewards);

router.get('/contributions', authenticate, controller.getUserContributions);

/**
 * @swagger
 * /users/{walletAddress}:
 *   get:
 *     summary: Get user by wallet address
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^0x[a-fA-F0-9]{40}$
 *         description: Ethereum wallet address
 *     responses:
 *       200:
 *         description: User found
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
 *                     role:
 *                       type: string
 *       400:
 *         description: Invalid wallet address format
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/:walletAddress', validate({ params: userSchemas.walletAddressParams }), controller.getUserByWallet);

export default router;
