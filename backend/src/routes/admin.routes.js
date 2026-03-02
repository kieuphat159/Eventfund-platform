import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/roles.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { adminSchemas } from '../validators/admin.validator.js';

const router = express.Router();
const controller = new AdminController();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative endpoints (admin role required)
 */

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     summary: Get platform-wide statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform statistics
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
 *                     users:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         byRole:
 *                           type: object
 *                         active:
 *                           type: integer
 *                     events:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         byStatus:
 *                           type: object
 *                     tickets:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         sold:
 *                           type: integer
 *                         used:
 *                           type: integer
 *                     listings:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         active:
 *                           type: integer
 *                     revenue:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: string
 *                         funding:
 *                           type: string
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (requires admin role)
 *       500:
 *         description: Server error
 */
router.get('/stats', authenticate, requireAdmin, (req, res, next) => controller.getPlatformStats(req, res, next));

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users with filters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, organizer, verifier, admin]
 *         description: Filter by user role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
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
 *         description: Sort field (prefix with - for descending)
 *     responses:
 *       200:
 *         description: List of users
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
 *                     docs:
 *                       type: array
 *                       items:
 *                         type: object
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
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (requires admin role)
 *       500:
 *         description: Server error
 */
router.get('/users', authenticate, requireAdmin, (req, res, next) => controller.getUsers(req, res, next));

/**
 * @swagger
 * /admin/users/{walletAddress}/role:
 *   patch:
 *     summary: Update user role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: User wallet address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, organizer, verifier, admin]
 *                 description: New role for the user
 *     responses:
 *       200:
 *         description: User role updated successfully
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
 *                     role:
 *                       type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (requires admin role)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.patch('/users/:walletAddress/role', authenticate, requireAdmin, validate({ body: adminSchemas.updateUserRole }), (req, res, next) => controller.updateUserRole(req, res, next));

/**
 * @swagger
 * /admin/events:
 *   get:
 *     summary: List all events (admin view)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, funding, funded, ticketing, ongoing, completed, cancelled, failed]
 *         description: Filter by event status
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
 *         name: sort
 *         schema:
 *           type: string
 *           default: -createdAt
 *         description: Sort field (prefix with - for descending)
 *     responses:
 *       200:
 *         description: List of events
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
 *                     docs:
 *                       type: array
 *                       items:
 *                         type: object
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
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (requires admin role)
 *       500:
 *         description: Server error
 */
router.get('/events', authenticate, requireAdmin, (req, res, next) => controller.getEvents(req, res, next));

/**
 * @swagger
 * /admin/events/{id}/status:
 *   patch:
 *     summary: Force update event status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, funding, funded, ticketing, ongoing, completed, cancelled, failed]
 *                 description: New status for the event
 *     responses:
 *       200:
 *         description: Event status updated successfully
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
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (requires admin role)
 *       404:
 *         description: Event not found
 *       500:
 *         description: Server error
 */
router.patch('/events/:id/status', authenticate, requireAdmin, validate({ body: adminSchemas.updateEventStatus }), (req, res, next) => controller.updateEventStatus(req, res, next));

/**
 * @swagger
 * /admin/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health status
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
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     services:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                             responseTime:
 *                               type: number
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (requires admin role)
 *       500:
 *         description: Server error
 */
router.get('/health', authenticate, requireAdmin, (req, res, next) => controller.getSystemHealth(req, res, next));

export default router;
