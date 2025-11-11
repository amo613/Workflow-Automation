import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import logger from '#config/logger.js';
import {
  initiateAuth,
  handleCallback,
  getStatus,
  disconnect,
  listSpreadsheets,
  getSheets,
} from '#controllers/google-sheets.controller.js';

// Fastify plugin function
export const googleSheetsRoutesFastify = async fastify => {
  // OAuth Flow
  // GET /api/integrations/google-sheets/auth
  fastify.get(
    '/auth',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        // Fastify sets request.user, but controller expects req.user
        request.req = request;
        request.req.user = request.user;
        return await initiateAuth(request, reply);
      } catch (error) {
        // Error handling to prevent crashes
        if (!reply.sent) {
          logger.error('Error in initiateAuth route:', error);
          return reply.status(500).send({
            error: 'Failed to initiate authentication',
            message: error.message || 'Unknown error'
          });
        }
      }
    }
  );

          // GET /api/integrations/google-sheets/callback
          // Kein Auth nötig, state enthält userId
          fastify.get('/callback', async (request, reply) => {
            try {
              // Fastify uses request.query directly, but controller expects req.query
              // Create a compatible req object
              const req = {
                query: request.query || {},
                headers: request.headers || {},
                request,
              };
              await handleCallback(req, reply);
            } catch (error) {
              // Error handling to prevent crashes
              if (!reply.sent) {
                logger.error('Error in handleCallback route:', error);
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                const returnUrl = request.query?.returnUrl || '/fullWorkflows';
                return reply.redirect(`${frontendUrl}${returnUrl}?googleSheets=error&error=${encodeURIComponent(error.message || 'OAuth callback failed')}`);
              }
            }
          });

  // GET /api/integrations/google-sheets/status
  fastify.get(
    '/status',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        // Fastify sets request.user, but controller expects req.user
        request.req = request;
        request.req.user = request.user;
        return await getStatus(request, reply);
      } catch (error) {
        // Error handling to prevent crashes
        if (!reply.sent) {
          logger.error('Error in getStatus route:', error);
          return reply.status(500).send({
            error: 'Failed to get status',
            message: error.message || 'Unknown error'
          });
        }
      }
    }
  );

  // DELETE /api/integrations/google-sheets
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
          logger.error('Error in disconnect route:', error);
          return reply.status(500).send({
            error: 'Failed to disconnect',
            message: error.message || 'Unknown error'
          });
        }
      }
    }
  );

  // GET /api/integrations/google-sheets/spreadsheets
  fastify.get(
    '/spreadsheets',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        // Fastify sets request.user, but controller expects req.user
        request.req = request;
        request.req.user = request.user;
        return await listSpreadsheets(request, reply);
      } catch (error) {
        // Error handling to prevent crashes
        if (!reply.sent) {
          logger.error('Error in listSpreadsheets route:', error);
          return reply.status(500).send({
            error: 'Failed to list spreadsheets',
            message: error.message || 'Unknown error'
          });
        }
      }
    }
  );

  // GET /api/integrations/google-sheets/spreadsheets/:spreadsheetId/sheets
  fastify.get(
    '/spreadsheets/:spreadsheetId/sheets',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        // Fastify sets request.user, but controller expects req.user
        request.req = request;
        request.req.user = request.user;
        return await getSheets(request, reply);
      } catch (error) {
        // Error handling to prevent crashes
        if (!reply.sent) {
          logger.error('Error in getSheets route:', error);
          return reply.status(500).send({
            error: 'Failed to get sheets',
            message: error.message || 'Unknown error'
          });
        }
      }
    }
  );
};

