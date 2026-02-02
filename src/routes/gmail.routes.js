import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import logger from '#config/logger.js';
import {
  initiateAuth,
  handleCallback,
  getStatus,
  disconnect,
} from '#controllers/gmail.controller.js';

// Fastify plugin function
export const gmailRoutesFastify = async fastify => {
  // OAuth Flow
  // GET /api/integrations/gmail/auth
  fastify.get(
    '/auth',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      return initiateAuth(request, reply);
    }
  );

  // GET /api/integrations/gmail/callback
  // Kein Auth nötig, state enthält userId
  fastify.get('/callback', async (request, reply) => {
    return handleCallback(request, reply);
  });

  // GET /api/integrations/gmail/status
  fastify.get(
    '/status',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      return getStatus(request, reply);
    }
  );

  // DELETE /api/integrations/gmail
  fastify.delete(
    '/',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        // Fastify sets request.user, but controller expects req.user
        request.req = request;
        request.req.user = request.user;
        return await disconnect(request, reply);
      } catch (error) {
        // Error handling to prevent crashes
        if (!reply.sent) {
          logger.error('Error in Gmail disconnect route:', error);
          return reply.status(500).send({
            error: 'Failed to disconnect',
            message: error.message || 'Unknown error',
          });
        }
      }
    }
  );
};


