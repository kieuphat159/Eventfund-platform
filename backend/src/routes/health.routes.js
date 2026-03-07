import express from 'express';
import HealthController from '../controllers/health.controller.js';

const router = express.Router();
const controller = new HealthController();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Health check endpoints (public)
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
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
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     version:
 *                       type: string
 *                       example: 1.0.0
 *                     uptime:
 *                       type: integer
 *                       description: Server uptime in seconds
 *                       example: 3600
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Server error
 */
router.get('/', controller.healthCheck);

/**
 * @swagger
 * /health/db:
 *   get:
 *     summary: Database health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Database is healthy
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
 *                     database:
 *                       type: string
 *                       example: connected
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       503:
 *         description: Database unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Database unavailable
 */
router.get('/db', controller.databaseHealth);

export default router;
