import express from 'express';
import TicketsController from '../controllers/tickets.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/roles.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { ticketSchemas } from '../validators/ticket.validator.js';

const router = express.Router();
const ticketsController = new TicketsController();

/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: Ticket management endpoints
 */

/**
 * @swagger
 * /tickets:
 *   get:
 *     summary: List tickets with filters and pagination
 *     tags: [Tickets]
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
 *           enum: [minted, sold, used, expired]
 *         description: Filter by ticket status
 *       - in: query
 *         name: currentOwner
 *         schema:
 *           type: string
 *         description: Filter by current owner wallet address
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
 *         name: sort
 *         schema:
 *           type: string
 *           default: -createdAt
 *         description: Sort field and order
 *     responses:
 *       200:
 *         description: List of tickets
 *       500:
 *         description: Server error
 */
router.get('/', validate({ query: ticketSchemas.queryTickets }), (req, res, next) => ticketsController.getTickets(req, res, next));

/**
 * @swagger
 * /tickets/{tokenId}:
 *   get:
 *     summary: Get single ticket by token ID
 *     tags: [Tickets]
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket token ID
 *     responses:
 *       200:
 *         description: Ticket details
 *       404:
 *         description: Ticket not found
 *       500:
 *         description: Server error
 */
router.get('/:tokenId', (req, res, next) => ticketsController.getTicketById(req, res, next));

/**
 * @swagger
 * /tickets/user/{walletAddress}:
 *   get:
 *     summary: Get all tickets owned by a wallet address
 *     tags: [Tickets]
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address
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
 *     responses:
 *       200:
 *         description: List of user tickets
 *       500:
 *         description: Server error
 */
router.get('/user/:walletAddress', (req, res, next) => ticketsController.getUserTickets(req, res, next));

/**
 * @swagger
 * /tickets/verify:
 *   post:
 *     summary: Verify ticket ownership
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenId
 *               - walletAddress
 *             properties:
 *               tokenId:
 *                 type: string
 *               walletAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification result
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (requires verifier role)
 *       404:
 *         description: Ticket not found
 *       500:
 *         description: Server error
 */
router.post('/verify', authenticate, requireRole('verifier', 'admin'), validate({ body: ticketSchemas.verifyTicket }), (req, res, next) => ticketsController.verifyTicket(req, res, next));

/**
 * @swagger
 * /tickets/{tokenId}/use:
 *   post:
 *     summary: Mark ticket as used during event check-in
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket token ID
 *     responses:
 *       200:
 *         description: Ticket marked as used
 *       400:
 *         description: Invalid ticket or event status
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (requires verifier role)
 *       404:
 *         description: Ticket not found
 *       500:
 *         description: Server error
 */
router.post('/:tokenId/use', authenticate, requireRole('verifier', 'admin'), validate({ body: ticketSchemas.useTicket }), (req, res, next) => ticketsController.markTicketAsUsed(req, res, next));

/**
 * @swagger
 * /tickets/event/{eventId}/stats:
 *   get:
 *     summary: Get ticket statistics for an event
 *     tags: [Tickets]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Ticket statistics
 *       500:
 *         description: Server error
 */
router.get('/event/:eventId/stats', (req, res, next) => ticketsController.getTicketStats(req, res, next));

export default router;
