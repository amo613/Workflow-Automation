import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import {
  initiateAuth,
  handleCallback,
  getStatus,
  disconnect,
  updateSettings,
} from '#controllers/google-calendar.controller.js';

// Fastify plugin function
export const googleCalendarRoutesFastify = async fastify => {
  // OAuth Flow
  // GET /api/integrations/google-calendar/auth
  fastify.get(
    '/auth',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      return initiateAuth(request, reply);
    }
  );

  // GET /api/integrations/google-calendar/callback
  // Kein Auth nötig, state enthält userId
  fastify.get('/callback', async (request, reply) => {
    return handleCallback(request, reply);
  });

  // GET /api/integrations/google-calendar/status
  fastify.get(
    '/status',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      return getStatus(request, reply);
    }
  );

  // PUT /api/integrations/google-calendar/settings
  fastify.put(
    '/settings',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      return updateSettings(request, reply);
    }
  );

  // DELETE /api/integrations/google-calendar
  fastify.delete(
    '/',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      return disconnect(request, reply);
    }
  );
};
