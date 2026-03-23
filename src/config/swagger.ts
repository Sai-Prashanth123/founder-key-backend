import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Golden Tap Connect / Founder Key API',
    version: '1.0.0',
    description: `
      Production-ready REST API for the Founder Key platform.

      ## Features
      - Authentication (JWT + Refresh Tokens)
      - User Profiles & Networking
      - Events Management
      - Founder Cards (QR-based)
      - Gamification (FK Score, Badges, Leaderboard)
      - Real-time Notifications
      - Organizer Dashboard
      - Admin Panel

      ## Authentication
      Use the **Authorize** button to set your Bearer token.
      All protected routes require: \`Authorization: Bearer <token>\`
    `,
    contact: {
      name: 'Golden Tap Connect API Support',
      email: 'api@goldentap.com',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}/api/${env.API_VERSION}`,
      description: 'Development server',
    },
    {
      url: `https://api.goldentap.com/api/${env.API_VERSION}`,
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { type: 'array', items: { type: 'object' } },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
              hasNext: { type: 'boolean' },
              hasPrev: { type: 'boolean' },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          errors: { type: 'array', items: { type: 'object' } },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['ATTENDEE', 'ORGANIZER', 'ADMIN'] },
          tier: { type: 'string', enum: ['FREE', 'FOUNDER'] },
          isActive: { type: 'boolean' },
          isEmailVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [],
};

// Lazy — generated on first request so it doesn't block server startup
let _spec: object | null = null;
export const getSwaggerSpec = (): object => {
  if (!_spec) {
    _spec = swaggerJsdoc(options);
  }
  return _spec;
};

// Keep named export for backward compat (returns empty object synchronously)
export const swaggerSpec = swaggerDefinition;
