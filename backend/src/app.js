import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config/env.js';
import logger from './config/logger.js';
import { setupSwagger } from './config/swagger.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

// Setup Swagger documentation
setupSwagger(app);

// Health check endpoint
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: DEV
 */
app.get('/health', (_, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// API routes will be added here
// app.use('/api/auth', authRoutes);
// app.use('/api/users', usersRoutes);
// app.use('/api/events', eventsRoutes);
// app.use('/api/tickets', ticketsRoutes);
// app.use('/api/marketplace', marketplaceRoutes);
// app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.url} not found`
    }
  });
});

// Error handler (will be replaced with proper middleware later)
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: {
      message: err.message,
      stack: err.stack
    },
    request: {
      method: req.method,
      url: req.url
    }
  });

  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: config.isDev ? err.message : 'Internal server error'
    }
  });
});

export default app;