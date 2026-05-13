import express from 'express';
import AuthController from '../controllers/auth.controller.js';
import AuthService from '../services/auth/auth.service.js';
import JWTService from '../services/auth/jwt.service.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import config from '../config/env.js';

const router = express.Router();

const jwtService = new JWTService(config.jwt.secret);
const authService = new AuthService(jwtService);
const controller = new AuthController(authService);

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Web3Auth JWT authentication endpoints
 */

// POST /api/auth/login - Web3Auth idToken login
router.post('/login', controller.login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
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
 */
router.post('/refresh', authenticate, controller.refreshToken);

export default router;
