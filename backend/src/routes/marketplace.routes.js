import express from 'express';
import MarketplaceController from '../controllers/marketplace.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { marketplaceSchemas } from '../validators/marketplace.validator.js';

const router = express.Router();
const marketplaceController = new MarketplaceController();

/**
 * @swagger
 * tags:
 *   name: Marketplace
 *   description: Marketplace management endpoints
 */

/**
 * @swagger
 * /marketplace/listings:
 *   get:
 *     summary: List marketplace listings with filters and pagination
 *     tags: [Marketplace]
 *     parameters:
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *         description: Filter by event ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, sold, cancelled, expired]
 *           default: active
 *         description: Filter by listing status
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: string
 *         description: Minimum price filter (string representation of wei amount)
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: string
 *         description: Maximum price filter (string representation of wei amount)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price, listedAt]
 *           default: listedAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of marketplace listings
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
 *                     docs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           ticketId:
 *                             type: string
 *                           tokenId:
 *                             type: string
 *                           eventId:
 *                             type: string
 *                           seller:
 *                             type: string
 *                           price:
 *                             type: string
 *                             description: Listing price (string representation of wei amount)
 *                           status:
 *                             type: string
 *                           listedAt:
 *                             type: string
 *                             format: date-time
 *                           expiresAt:
 *                             type: string
 *                             format: date-time
 *                     totalDocs:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *       500:
 *         description: Server error
 */
router.get('/listings', validate({ query: marketplaceSchemas.queryListings }), (req, res, next) => marketplaceController.getListings(req, res, next));

/**
 * @swagger
 * /marketplace/listings/{id}:
 *   get:
 *     summary: Get single marketplace listing by ID
 *     tags: [Marketplace]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing ID
 *     responses:
 *       200:
 *         description: Listing details
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
 *                     ticketId:
 *                       type: string
 *                     tokenId:
 *                       type: string
 *                     eventId:
 *                       type: string
 *                     seller:
 *                       type: string
 *                     price:
 *                       type: string
 *                       description: Listing price (string representation of wei amount)
 *                     maxPrice:
 *                       type: string
 *                       description: Maximum allowed price (string representation of wei amount)
 *                     status:
 *                       type: string
 *                     listedAt:
 *                       type: string
 *                       format: date-time
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Listing not found
 *       500:
 *         description: Server error
 */
router.get('/listings/:id', (req, res, next) => marketplaceController.getListingById(req, res, next));

/**
 * @swagger
 * /marketplace/listings:
 *   post:
 *     summary: Create new marketplace listing
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ticketId
 *               - price
 *               - expiresAt
 *             properties:
 *               ticketId:
 *                 type: string
 *                 description: ID of the ticket to list
 *               price:
 *                 type: string
 *                 description: Listing price (string representation of wei amount, max 1.5x original price)
 *                 example: "1000000000000000000"
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Listing expiration date (must be future date)
 *     responses:
 *       201:
 *         description: Listing created successfully
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
 *                     ticketId:
 *                       type: string
 *                     price:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Validation error (price exceeds cap, ticket already listed, etc.)
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (must own ticket)
 *       404:
 *         description: Ticket not found
 *       500:
 *         description: Server error
 */
router.post('/listings', authenticate, validate({ body: marketplaceSchemas.createListing }), (req, res, next) => marketplaceController.createListing(req, res, next));

router.post(
	'/listings/intent',
	authenticate,
	validate({ body: marketplaceSchemas.createListingIntent }),
	(req, res, next) => marketplaceController.createListingIntent(req, res, next)
);

router.post(
	'/listings/:id/buy-intent',
	authenticate,
	(req, res, next) => marketplaceController.createBuyListingIntent(req, res, next)
);

router.post(
	'/listings/:id/cancel-intent',
	authenticate,
	(req, res, next) => marketplaceController.createCancelListingIntent(req, res, next)
);

router.post(
	'/listings/confirm-sold',
	authenticate,
	validate({ body: marketplaceSchemas.confirmSoldTransaction }),
	(req, res, next) => marketplaceController.confirmSoldTransaction(req, res, next)
);

/**
 * @swagger
 * /marketplace/listings/{id}:
 *   delete:
 *     summary: Cancel marketplace listing
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing ID
 *     responses:
 *       200:
 *         description: Listing cancelled successfully
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
 *                     status:
 *                       type: string
 *                       example: cancelled
 *       400:
 *         description: Listing not active
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (must be seller)
 *       404:
 *         description: Listing not found
 *       500:
 *         description: Server error
 */
router.delete('/listings/:id', authenticate, (req, res, next) => marketplaceController.cancelListing(req, res, next));

/**
 * @swagger
 * /marketplace/stats:
 *   get:
 *     summary: Get marketplace statistics
 *     tags: [Marketplace]
 *     responses:
 *       200:
 *         description: Marketplace statistics
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
 *                     totalListings:
 *                       type: integer
 *                       description: Total number of listings
 *                     activeListings:
 *                       type: integer
 *                       description: Number of active listings
 *                     totalSales:
 *                       type: integer
 *                       description: Total number of completed sales
 *                     totalVolume:
 *                       type: string
 *                       description: Total sales volume (string representation of wei amount)
 *                     averagePrice:
 *                       type: string
 *                       description: Average listing price (string representation of wei amount)
 *                     listingsByEvent:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           eventId:
 *                             type: string
 *                           count:
 *                             type: integer
 *       500:
 *         description: Server error
 */
router.get('/stats', (req, res, next) => marketplaceController.getMarketplaceStats(req, res, next));

export default router;
