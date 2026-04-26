import express from "express";
import EventsController from "../controllers/events.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireEventCreator } from "../middlewares/roles.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { eventSchemas } from "../validators/event.validator.js";
import { requireAdmin } from "../middlewares/roles.middleware.js";
import {
  uploadEventImagesOptional,
  validateMultipleImages,
  parseFormDataJSON,
} from "../middlewares/image.middleware.js";

const router = express.Router();
const controller = new EventsController();

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Event management endpoints
 */

/**
 * @swagger
 * /events:
 *   get:
 *     summary: List events with filters and pagination
 *     tags: [Events]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, funding, funded, ticketing, ongoing, completed, cancelled, failed]
 *         description: Filter by event status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by event category
 *       - in: query
 *         name: organizer
 *         schema:
 *           type: string
 *         description: Filter by organizer wallet address
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
 *           default: createdAt
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
 *         description: List of events
 *       500:
 *         description: Server error
 */
router.get(
  "/",
  validate({ query: eventSchemas.queryEvents }),
  controller.getEvents,
);

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create new event draft (authenticated user or admin)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - fundingGoal
 *               - fundingDeadline
 *               - startDate
 *               - endDate
 *               - totalTickets
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Web3 Developer Conference 2026"
 *               description:
 *                 type: string
 *                 example: "Annual conference for blockchain developers and Web3 enthusiasts"
 *               category:
 *                 type: string
 *                 example: "conference"
 *               fundingGoal:
 *                 type: string
 *                 description: Funding goal amount (string representation of wei amount)
 *                 example: "5000000000000000000"
 *               minStakeRequired:
 *                 type: string
 *                 description: Minimum stake required (string representation of wei amount)
 *                 example: "1000000000000000000"
 *               fundingDeadline:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-04-15T23:59:59Z"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-05-20T09:00:00Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-05-22T18:00:00Z"
 *               totalTickets:
 *                 type: integer
 *                 example: 500
 *               venue:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Tech Convention Center"
 *                   address:
 *                     type: string
 *                     example: "123 Innovation Drive"
 *                 example:
 *                   name: "Tech Convention Center"
 *                   address: "123 Innovation Drive"
 *           example:
 *             title: "Web3 Developer Conference 2026"
 *             description: "Annual conference for blockchain developers and Web3 enthusiasts"
 *             category: "conference"
 *             fundingGoal: "5000000000000000000"
 *             minStakeRequired: "1000000000000000000"
 *             fundingDeadline: "2026-04-15T23:59:59Z"
 *             startDate: "2026-05-20T09:00:00Z"
 *             endDate: "2026-05-22T18:00:00Z"
 *             totalTickets: 500
 *             venue:
 *               name: "Tech Convention Center"
 *               address: "123 Innovation Drive"
 *     responses:
 *       201:
 *         description: Event created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.post(
  "/",
  authenticate,
  requireEventCreator,
  uploadEventImagesOptional,
  parseFormDataJSON,
  validateMultipleImages,
  validate({ body: eventSchemas.createEvent }),
  controller.createEvent,
);

router.post(
  "/create-intent",
  authenticate,
  requireEventCreator,
  uploadEventImagesOptional,
  parseFormDataJSON,
  validateMultipleImages,
  validate({ body: eventSchemas.createEventIntent }),
  controller.createEventIntent,
);

router.post(
  "/create/confirm",
  authenticate,
  requireEventCreator,
  validate({ body: eventSchemas.confirmCreateEvent }),
  controller.confirmCreateEventTransaction,
);

router.get("/blockchain-config", controller.getBlockchainConfig);

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Event details
 *       404:
 *         description: Event not found
 *       500:
 *         description: Server error
 */
router.get("/:id", controller.getEventById);

/**
 * @swagger
 * /events/{id}:
 *   patch:
 *     summary: Update event content (creator/admin, must own event unless admin)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Web3 Developer Conference 2026 - Updated"
 *               description:
 *                 type: string
 *                 example: "Updated description with more details about speakers and workshops"
 *               category:
 *                 type: string
 *                 example: "conference"
 *               venue:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   address:
 *                     type: string
 *                 example:
 *                   name: "New Convention Center"
 *                   address: "456 Tech Boulevard"
 *           example:
 *             title: "Web3 Developer Conference 2026 - Updated"
 *             description: "Updated description with more details about speakers and workshops"
 *             category: "conference"
 *             venue:
 *               name: "New Convention Center"
 *               address: "456 Tech Boulevard"
 *     responses:
 *       200:
 *         description: Event updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (ownership required unless admin)
 *       404:
 *         description: Event not found
 *       500:
 *         description: Server error
 */
router.patch(
  "/:id",
  authenticate,
  requireEventCreator,
  uploadEventImagesOptional,
  parseFormDataJSON,
  validateMultipleImages,
  validate({ body: eventSchemas.updateEvent }),
  controller.updateEvent,
);

/**
 * @swagger
 * /events/{id}:
 *   delete:
 *     summary: Delete draft event (creator/admin, must own event, draft only)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *       400:
 *         description: Cannot delete non-draft event
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (ownership required unless admin)
 *       404:
 *         description: Event not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/:id",
  authenticate,
  requireEventCreator,
  controller.deleteEvent,
);

/**
 * @swagger
 * /events/{id}/invest:
 *   post:
 *     summary: Invest in an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: string
 *                 description: Investment amount as a positive integer string
 *                 example: "10"
 *     responses:
 *       200:
 *         description: Investment created successfully
 *       400:
 *         description: Validation error or event not open for investment
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Event not found
 *       500:
 *         description: Server error
 */
router.post(
  "/:id/invest-intent",
  authenticate,
  validate({ body: eventSchemas.investEvent }),
  controller.createInvestmentIntent,
);

router.post(
  "/:id/invest/confirm",
  authenticate,
  validate({ body: eventSchemas.confirmInvestEvent }),
  controller.confirmInvestmentTransaction,
);

router.post(
  "/:id/invest",
  authenticate,
  validate({ body: eventSchemas.investEvent }),
  controller.investInEvent,
);

/**
 * @swagger
 * /events/{id}/images/{imageUrl}:
 *   delete:
 *     summary: Delete a specific image from an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: path
 *         name: imageUrl
 *         required: true
 *         schema:
 *           type: string
 *         description: URL-encoded image URL to delete
 *         example: "https%3A%2F%2Fres.cloudinary.com%2Fdemo%2Fimage%2Fupload%2Fv123%2Fevents%2F123%2Fimage.jpg"
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (ownership required unless admin)
 *       404:
 *         description: Event or image not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/:id/images/:imageUrl",
  authenticate,
  requireEventCreator,
  controller.deleteEventImage,
);

/**
 * @swagger
 * /events/{id}/stats:
 *   get:
 *     summary: Get event statistics
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Event statistics
 *       404:
 *         description: Event not found
 *       500:
 *         description: Server error
 */
router.get("/:id/stats", controller.getEventStats);

// 🔥 NEW: assign verifier (admin only)
router.post(
  "/:id/assign-verifier",
  authenticate,
  requireAdmin,
  controller.assignVerifier,
);

export default router;
