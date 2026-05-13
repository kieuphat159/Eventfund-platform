import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import config from './env.js';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EventFund Platform API',
      version: '1.0.0',
      description: 'Web3 Event Platform with SIWE authentication and blockchain integration',
      contact: {
        name: 'EventFund Team',
        email: 'support@eventfund.example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api`,
        description: 'Development server'
      },
      {
        url: 'https://api.eventfund.example.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/verify endpoint'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR'
                },
                message: {
                  type: 'string',
                  example: 'Invalid input data'
                }
              }
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              example: 1
            },
            limit: {
              type: 'integer',
              example: 20
            },
            total: {
              type: 'integer',
              example: 150
            },
            pages: {
              type: 'integer',
              example: 8
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints'
      },
      {
        name: 'Authentication',
        description: 'SIWE authentication endpoints'
      },
      {
        name: 'Events',
        description: 'Event management endpoints'
      },
      {
        name: 'Tickets',
        description: 'Ticket management and verification'
      },
      {
        name: 'Marketplace',
        description: 'Secondary market for ticket resale'
      },
      {
        name: 'Users',
        description: 'User profile and portfolio'
      },
      {
        name: 'Admin',
        description: 'Administrative endpoints'
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/models/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger documentation
 * @param {Express} app - Express application instance
 */
export const setupSwagger = (app) => {
  // Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'EventFund API Documentation'
  }));

  // Swagger JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

export default swaggerSpec;
